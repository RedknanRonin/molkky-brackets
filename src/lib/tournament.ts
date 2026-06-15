import "server-only";
import { prisma } from "@/lib/prisma";

// ---------- helpers ----------

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

function seedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

export type Settings = { groupCount?: number; advancersPerGroup?: number };

// ---------- standings ----------

export type Standing = {
  playerId: string;
  name: string;
  groupName: string | null;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
};

type SimplePlayer = { id: string; name: string; groupName: string | null };
type SimpleMatch = {
  player1Id: string | null;
  player2Id: string | null;
  player1Score: number | null;
  player2Score: number | null;
  winnerId: string | null;
  status: string;
};

export function computeStandingsFromMatches(
  players: SimplePlayer[],
  matches: SimpleMatch[],
): Standing[] {
  const table = new Map<string, Standing>();
  for (const p of players) {
    table.set(p.id, {
      playerId: p.id,
      name: p.name,
      groupName: p.groupName,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== "COMPLETED") continue;
    if (!m.player1Id || !m.player2Id) continue;
    const s1 = table.get(m.player1Id);
    const s2 = table.get(m.player2Id);
    const a = m.player1Score ?? 0;
    const b = m.player2Score ?? 0;
    if (s1) {
      s1.played++;
      s1.pointsFor += a;
      s1.pointsAgainst += b;
      if (m.winnerId === m.player1Id) s1.wins++;
      else s1.losses++;
    }
    if (s2) {
      s2.played++;
      s2.pointsFor += b;
      s2.pointsAgainst += a;
      if (m.winnerId === m.player2Id) s2.wins++;
      else s2.losses++;
    }
  }

  const out = [...table.values()];
  for (const s of out) s.diff = s.pointsFor - s.pointsAgainst;
  out.sort(
    (x, y) =>
      y.wins - x.wins ||
      y.diff - x.diff ||
      y.pointsFor - x.pointsFor ||
      x.name.localeCompare(y.name),
  );
  return out;
}

export async function computeStandings(
  tournamentId: string,
  opts: { groupName?: string } = {},
): Promise<Standing[]> {
  const players = await prisma.player.findMany({
    where: { tournamentId, ...(opts.groupName ? { groupName: opts.groupName } : {}) },
  });
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      ...(opts.groupName ? { groupName: opts.groupName } : {}),
    },
  });
  return computeStandingsFromMatches(players, matches);
}

// ---------- bracket builders ----------
// NOTE: We use plain `prisma.*` calls (no interactive transactions) to stay
// compatible with the PrismaPg driver adapter used on Vercel.

async function createSingleElim(
  tournamentId: string,
  orderedPlayerIds: string[],
  startMatchNumber = 1,
): Promise<string | null> {
  const n = orderedPlayerIds.length;
  if (n < 2) return null;
  const size = nextPow2(n);
  const order = seedOrder(size);
  const slotPlayers = order.map((seed) =>
    seed <= n ? orderedPlayerIds[seed - 1] : null,
  );

  const totalRounds = Math.log2(size);
  const grid: string[][] = [];
  let matchNumber = startMatchNumber;

  // 1. Create all match shells
  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const m = await prisma.match.create({
        data: {
          tournamentId,
          stage: "KNOCKOUT",
          round: r,
          matchNumber: matchNumber++,
          status: "PENDING",
        },
      });
      ids.push(m.id);
    }
    grid.push(ids);
  }

  // 2. Link winners forward
  for (let r = 0; r < totalRounds - 1; r++) {
    for (let i = 0; i < grid[r].length; i++) {
      await prisma.match.update({
        where: { id: grid[r][i] },
        data: {
          nextMatchId: grid[r + 1][Math.floor(i / 2)],
          nextSlot: i % 2 === 0 ? 1 : 2,
        },
      });
    }
  }

  // 3. Seed round 1
  for (let i = 0; i < grid[0].length; i++) {
    await prisma.match.update({
      where: { id: grid[0][i] },
      data: { player1Id: slotPlayers[2 * i], player2Id: slotPlayers[2 * i + 1] },
    });
  }

  // 4. Resolve byes (exactly one player → auto-advance)
  for (let i = 0; i < grid[0].length; i++) {
    const p1 = slotPlayers[2 * i];
    const p2 = slotPlayers[2 * i + 1];
    if ((p1 && !p2) || (!p1 && p2)) {
      await advanceWinner(grid[0][i], (p1 ?? p2)!, null, null, "BYE");
    }
  }

  return grid[totalRounds - 1][0];
}

async function createRoundRobin(
  tournamentId: string,
  playerIds: string[],
  stage: "ROUND_ROBIN" | "GROUP",
  groupName: string | null,
  startMatchNumber = 1,
) {
  const arr: (string | null)[] = [...playerIds];
  if (arr.length % 2 === 1) arr.push(null);
  const rounds = arr.length - 1;
  const half = arr.length / 2;
  let matchNumber = startMatchNumber;

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      if (a && b) {
        await prisma.match.create({
          data: {
            tournamentId,
            stage,
            groupName,
            round: r + 1,
            matchNumber: matchNumber++,
            player1Id: a,
            player2Id: b,
            status: "PENDING",
          },
        });
      }
    }
    arr.splice(1, 0, arr.pop()!);
  }
  return matchNumber;
}

// ---------- internal helpers ----------

// Read a match's nextMatchId/nextSlot, then set the winner into the next match.
async function advanceWinner(
  matchId: string,
  winnerId: string,
  p1Score: number | null,
  p2Score: number | null,
  judgeName: string | null,
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  await prisma.match.update({
    where: { id: matchId },
    data: {
      player1Score: p1Score,
      player2Score: p2Score,
      winnerId,
      status: "COMPLETED",
      judgeName: judgeName ?? match.judgeName,
    },
  });

  if (match.nextMatchId) {
    await prisma.match.update({
      where: { id: match.nextMatchId },
      data: match.nextSlot === 1 ? { player1Id: winnerId } : { player2Id: winnerId },
    });
  }
}

// ---------- double-elimination bracket ----------

async function generateDoubleElim(
  tournamentId: string,
  orderedPlayerIds: string[],
) {
  const n = orderedPlayerIds.length;
  if (n < 2) return;
  const size = nextPow2(n);
  const k = Math.log2(size); // WB has k rounds
  const order = seedOrder(size);
  const slotPlayers = order.map((seed) =>
    seed <= n ? orderedPlayerIds[seed - 1] : null,
  );

  let matchNumber = 1;

  // ---- 1. Create WB match shells ----
  // grid[r] = array of match IDs for WB round r (1-indexed, grid[0] unused)
  const wbGrid: string[][] = [[]]; // index 0 unused
  for (let r = 1; r <= k; r++) {
    const count = size / 2 ** r;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const m = await prisma.match.create({
        data: {
          tournamentId,
          stage: "KNOCKOUT",
          round: r,
          matchNumber: matchNumber++,
          status: "PENDING",
          bracketSection: "WB",
        },
      });
      ids.push(m.id);
    }
    wbGrid.push(ids);
  }

  // ---- 2. Link WB winner advancement ----
  for (let r = 1; r < k; r++) {
    for (let i = 0; i < wbGrid[r].length; i++) {
      await prisma.match.update({
        where: { id: wbGrid[r][i] },
        data: {
          nextMatchId: wbGrid[r + 1][Math.floor(i / 2)],
          nextSlot: i % 2 === 0 ? 1 : 2,
        },
      });
    }
  }

  // ---- 3. Seed WB R1 players ----
  for (let i = 0; i < wbGrid[1].length; i++) {
    await prisma.match.update({
      where: { id: wbGrid[1][i] },
      data: { player1Id: slotPlayers[2 * i], player2Id: slotPlayers[2 * i + 1] },
    });
  }

  // ---- 4. Resolve WB byes ----
  for (let i = 0; i < wbGrid[1].length; i++) {
    const p1 = slotPlayers[2 * i];
    const p2 = slotPlayers[2 * i + 1];
    if ((p1 && !p2) || (!p1 && p2)) {
      await advanceWinner(wbGrid[1][i], (p1 ?? p2)!, null, null, "BYE");
    }
  }

  // ---- 5. Build LB rounds ----
  // LB round numbering is sequential. We use a virtual LB round counter.
  // lbGrid[lbRound] = array of match IDs
  // We also track which WB round feeds losers into each LB round.
  //
  // Structure (for size=8, k=3):
  //   LB R1 (consolidation): size/4 = 2 matches — WB R1 losers paired up
  //   LB R2 (integration):   size/4 = 2 matches — LB R1 winners vs WB R2 losers
  //   LB R3 (consolidation): size/8 = 1 match  — LB R2 winners paired up
  //   LB R4 (integration):   size/8 = 1 match  — LB R3 winner vs WB R3 loser (WB Final loser)
  // Then Grand Final.
  //
  // General pattern: LB has 2*(k-1) rounds.
  // Odd LB rounds (1,3,5,...) are consolidation (no new WB entrants, pair previous LB winners).
  // Even LB rounds (2,4,6,...) are integration (LB winners vs the next tier of WB losers).
  // WB losers enter at:
  //   LB R1: WB R1 losers (size/2 players → size/4 matches)
  //   LB R2: WB R2 losers
  //   LB R4: WB R3 losers
  //   LB R(2j): WB R(j+1) losers, for j=1..(k-1)

  const lbGrid: string[][] = [[]]; // index 0 unused; lbGrid[lb] = match IDs for LB round lb
  const totalLbRounds = 2 * (k - 1);

  // Helper: track WB round loser arrays (filled as we create LB matches)
  // We'll set loserMatchId/loserSlot on WB matches when we know the LB targets.

  let prevLbIds: string[] = []; // match IDs from the previous LB round

  for (let lb = 1; lb <= totalLbRounds; lb++) {
    const isIntegration = lb % 2 === 0;
    const wbRoundForLosers = isIntegration ? lb / 2 + 1 : 0; // WB round whose losers enter this LB round (integration only)

    // Number of matches in this LB round
    let matchCount: number;
    if (lb === 1) {
      matchCount = size / 4; // WB R1 has size/2 losers → pair into size/4 matches
    } else if (isIntegration) {
      matchCount = prevLbIds.length; // same count as prev (one LB winner + one WB loser each)
    } else {
      matchCount = prevLbIds.length / 2; // consolidation halves the field
    }

    const ids: string[] = [];
    for (let i = 0; i < matchCount; i++) {
      const m = await prisma.match.create({
        data: {
          tournamentId,
          stage: "KNOCKOUT",
          round: k + lb, // LB rounds follow WB rounds in the round numbering
          matchNumber: matchNumber++,
          status: "PENDING",
          bracketSection: "LB",
        },
      });
      ids.push(m.id);
    }
    lbGrid.push(ids);

    if (lb === 1) {
      // Consolidation: pair WB R1 losers
      // WB R1 losers: wbGrid[1][0], wbGrid[1][1], ..., (size/2 matches → size/2 losers)
      // Pair them: LB R1 match i ← loser of WB R1[2i] (slot 1) and loser of WB R1[2i+1] (slot 2)
      for (let i = 0; i < matchCount; i++) {
        await prisma.match.update({
          where: { id: wbGrid[1][2 * i] },
          data: { loserMatchId: ids[i], loserSlot: 1 },
        });
        await prisma.match.update({
          where: { id: wbGrid[1][2 * i + 1] },
          data: { loserMatchId: ids[i], loserSlot: 2 },
        });
      }
    } else if (isIntegration) {
      // Integration: link prev LB round winners and WB round losers
      // prevLbIds[i].winner → slot 1; WB R(wbRoundForLosers)[i] loser → slot 2
      for (let i = 0; i < matchCount; i++) {
        // Link prev LB match winner → this LB match slot 1
        await prisma.match.update({
          where: { id: prevLbIds[i] },
          data: { nextMatchId: ids[i], nextSlot: 1 },
        });
        // Link WB loser → this LB match slot 2
        await prisma.match.update({
          where: { id: wbGrid[wbRoundForLosers][i] },
          data: { loserMatchId: ids[i], loserSlot: 2 },
        });
      }
    } else {
      // Consolidation: pair up prev LB round winners
      for (let i = 0; i < matchCount; i++) {
        await prisma.match.update({
          where: { id: prevLbIds[2 * i] },
          data: { nextMatchId: ids[i], nextSlot: 1 },
        });
        await prisma.match.update({
          where: { id: prevLbIds[2 * i + 1] },
          data: { nextMatchId: ids[i], nextSlot: 2 },
        });
      }
    }

    prevLbIds = ids;
  }

  // ---- 6. Grand Final ----
  const gf = await prisma.match.create({
    data: {
      tournamentId,
      stage: "KNOCKOUT",
      round: k + totalLbRounds + 1,
      matchNumber: matchNumber++,
      status: "PENDING",
      bracketSection: "GF",
    },
  });

  // WB Final winner → GF slot 1
  await prisma.match.update({
    where: { id: wbGrid[k][0] },
    data: { nextMatchId: gf.id, nextSlot: 1 },
  });

  // WB Final loser → LB Final (last LB round, slot 2) — already set via integration above
  // But for k=1 (2 players) there are no LB rounds, handle that edge case:
  if (totalLbRounds > 0) {
    // LB Final winner → GF slot 2
    const lbFinalId = prevLbIds[0];
    await prisma.match.update({
      where: { id: lbFinalId },
      data: { nextMatchId: gf.id, nextSlot: 2 },
    });
  }
}

// ---------- public API ----------

export async function generateBracket(tournamentId: string) {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { players: { orderBy: { createdAt: "asc" } }, matches: true },
  });
  if (!t) throw new Error("Tournament not found");
  if (t.matches.length > 0) throw new Error("Tournament already started");
  if (t.players.length < 2) throw new Error("Need at least 2 players");

  // Assign seeds by join order
  const players = t.players;
  for (let i = 0; i < players.length; i++) {
    await prisma.player.update({
      where: { id: players[i].id },
      data: { seed: i + 1 },
    });
  }
  const ids = players.map((p) => p.id);

  if (t.format === "SINGLE_ELIM") {
    await createSingleElim(tournamentId, ids);
  } else if (t.format === "DOUBLE_ELIM") {
    await generateDoubleElim(tournamentId, ids);
  } else if (t.format === "ROUND_ROBIN") {
    await createRoundRobin(tournamentId, ids, "ROUND_ROBIN", null);
  } else {
    // GROUP_KNOCKOUT
    const settings = (t.settings as Settings) ?? {};
    const groupCount = Math.max(1, Math.min(settings.groupCount ?? 2, ids.length));
    const groupNames = Array.from({ length: groupCount }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const groups: string[][] = groupNames.map(() => []);
    ids.forEach((id, i) => groups[i % groupCount].push(id));

    let matchNumber = 1;
    for (let g = 0; g < groupCount; g++) {
      for (const pid of groups[g]) {
        await prisma.player.update({
          where: { id: pid },
          data: { groupName: groupNames[g] },
        });
      }
      if (groups[g].length >= 2) {
        matchNumber = await createRoundRobin(
          tournamentId,
          groups[g],
          "GROUP",
          groupNames[g],
          matchNumber,
        );
      }
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "IN_PROGRESS" },
  });
}

export type ResultInput = {
  matchId: string;
  player1Score: number;
  player2Score: number;
  winnerId: string;
  judgeName: string;
};

export async function recordResult(input: ResultInput) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: { tournament: true },
  });
  if (!match) throw new Error("Match not found");
  if (!match.player1Id || !match.player2Id) {
    throw new Error("Match is not ready (missing a player)");
  }
  if (input.winnerId !== match.player1Id && input.winnerId !== match.player2Id) {
    throw new Error("Winner must be one of the two players");
  }

  await advanceWinner(
    input.matchId,
    input.winnerId,
    input.player1Score,
    input.player2Score,
    input.judgeName,
  );

  const t = match.tournament;

  // Double-elim: advance the loser to their LB match
  if (t.format === "DOUBLE_ELIM" && match.loserMatchId) {
    const loserId =
      match.player1Id === input.winnerId ? match.player2Id : match.player1Id;
    if (loserId) {
      await prisma.match.update({
        where: { id: match.loserMatchId },
        data: match.loserSlot === 1 ? { player1Id: loserId } : { player2Id: loserId },
      });
    }
  }

  if (t.format === "GROUP_KNOCKOUT" && match.stage === "GROUP") {
    const remaining = await prisma.match.count({
      where: { tournamentId: t.id, stage: "GROUP", status: { not: "COMPLETED" } },
    });
    const knockoutExists = await prisma.match.count({
      where: { tournamentId: t.id, stage: "KNOCKOUT" },
    });
    if (remaining === 0 && knockoutExists === 0) {
      await buildKnockoutFromGroups(t.id, (t.settings as Settings) ?? {});
    }
  }

  // Mark tournament COMPLETED when the final knockout match is done
  const isDoubleElimFinal =
    t.format === "DOUBLE_ELIM" &&
    match.bracketSection === "GF" &&
    !match.nextMatchId;
  const isSingleElimFinal =
    t.format !== "DOUBLE_ELIM" &&
    (match.stage === "KNOCKOUT" || t.format === "SINGLE_ELIM") &&
    !match.nextMatchId;
  if (isDoubleElimFinal || isSingleElimFinal) {
    await prisma.tournament.update({
      where: { id: t.id },
      data: { status: "COMPLETED" },
    });
  }

  // Round-robin: complete when all matches done
  if (t.format === "ROUND_ROBIN") {
    const remaining = await prisma.match.count({
      where: { tournamentId: t.id, status: { not: "COMPLETED" } },
    });
    if (remaining === 0) {
      await prisma.tournament.update({
        where: { id: t.id },
        data: { status: "COMPLETED" },
      });
    }
  }
}

async function buildKnockoutFromGroups(tournamentId: string, settings: Settings) {
  const advancersPerGroup = Math.max(1, settings.advancersPerGroup ?? 2);
  const players = await prisma.player.findMany({ where: { tournamentId } });
  const matches = await prisma.match.findMany({
    where: { tournamentId, stage: "GROUP" },
  });

  const groupNames = [
    ...new Set(players.map((p) => p.groupName).filter(Boolean)),
  ].sort() as string[];

  const perGroupRanked = groupNames.map((g) =>
    computeStandingsFromMatches(
      players.filter((p) => p.groupName === g),
      matches.filter((m) => m.groupName === g),
    ).slice(0, advancersPerGroup),
  );

  const seededIds: string[] = [];
  for (let rank = 0; rank < advancersPerGroup; rank++) {
    for (const ranked of perGroupRanked) {
      if (ranked[rank]) seededIds.push(ranked[rank].playerId);
    }
  }

  if (seededIds.length >= 2) {
    const agg = await prisma.match.aggregate({
      where: { tournamentId },
      _max: { matchNumber: true },
    });
    await createSingleElim(
      tournamentId,
      seededIds,
      (agg._max.matchNumber ?? 0) + 1,
    );
  }
}
