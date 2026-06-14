import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// A minimal transaction client type (the parts we use).
type Tx = Prisma.TransactionClient;

// ---------- helpers ----------

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

// Standard single-elimination seed slot order for a bracket of `size` (power of 2).
// Returns seed numbers (1-indexed) in slot order, so that top seeds are spread out
// and the lowest seeds face the highest.
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

// Build a single-elimination bracket from an ordered list of seeded player ids.
// Returns the id of the final match.
async function createSingleElim(
  tx: Tx,
  tournamentId: string,
  orderedPlayerIds: string[],
  startMatchNumber = 1,
): Promise<string | null> {
  const n = orderedPlayerIds.length;
  if (n < 2) return null;
  const size = nextPow2(n);
  const order = seedOrder(size);
  // slotPlayers[i] = player id at bracket slot i (or null = bye)
  const slotPlayers = order.map((seed) =>
    seed <= n ? orderedPlayerIds[seed - 1] : null,
  );

  const totalRounds = Math.log2(size);
  const grid: string[][] = []; // grid[round-1] = match ids
  let matchNumber = startMatchNumber;

  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const m = await tx.match.create({
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

  // link winners forward
  for (let r = 0; r < totalRounds - 1; r++) {
    for (let i = 0; i < grid[r].length; i++) {
      await tx.match.update({
        where: { id: grid[r][i] },
        data: {
          nextMatchId: grid[r + 1][Math.floor(i / 2)],
          nextSlot: i % 2 === 0 ? 1 : 2,
        },
      });
    }
  }

  // seed round 1
  for (let i = 0; i < grid[0].length; i++) {
    await tx.match.update({
      where: { id: grid[0][i] },
      data: { player1Id: slotPlayers[2 * i], player2Id: slotPlayers[2 * i + 1] },
    });
  }

  // resolve byes (a round-1 match with exactly one player auto-advances)
  for (let i = 0; i < grid[0].length; i++) {
    const p1 = slotPlayers[2 * i];
    const p2 = slotPlayers[2 * i + 1];
    if ((p1 && !p2) || (!p1 && p2)) {
      await completeAndAdvance(tx, grid[0][i], (p1 ?? p2)!, null, null, "BYE");
    }
  }

  return grid[totalRounds - 1][0];
}

// Round-robin schedule via the circle method.
async function createRoundRobin(
  tx: Tx,
  tournamentId: string,
  playerIds: string[],
  stage: "ROUND_ROBIN" | "GROUP",
  groupName: string | null,
  startMatchNumber = 1,
) {
  const arr: (string | null)[] = [...playerIds];
  if (arr.length % 2 === 1) arr.push(null); // bye marker
  const rounds = arr.length - 1;
  const half = arr.length / 2;
  let matchNumber = startMatchNumber;

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      if (a && b) {
        await tx.match.create({
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
    // rotate (keep first fixed)
    arr.splice(1, 0, arr.pop()!);
  }
  return matchNumber;
}

// ---------- public API ----------

export async function generateBracket(tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { players: { orderBy: { createdAt: "asc" } }, matches: true },
    });
    if (!t) throw new Error("Tournament not found");
    if (t.matches.length > 0) throw new Error("Tournament already started");
    if (t.players.length < 2) throw new Error("Need at least 2 players");

    // assign seeds by join order
    const players = t.players;
    for (let i = 0; i < players.length; i++) {
      await tx.player.update({ where: { id: players[i].id }, data: { seed: i + 1 } });
    }
    const ids = players.map((p) => p.id);

    if (t.format === "SINGLE_ELIM") {
      await createSingleElim(tx, tournamentId, ids);
    } else if (t.format === "ROUND_ROBIN") {
      await createRoundRobin(tx, tournamentId, ids, "ROUND_ROBIN", null);
    } else {
      // GROUP_KNOCKOUT
      const settings = (t.settings as Settings) ?? {};
      const groupCount = Math.max(1, Math.min(settings.groupCount ?? 2, ids.length));
      const groupNames = Array.from({ length: groupCount }, (_, i) =>
        String.fromCharCode(65 + i),
      );
      // distribute snake-free (round robin assignment)
      const groups: string[][] = groupNames.map(() => []);
      ids.forEach((id, i) => groups[i % groupCount].push(id));

      let matchNumber = 1;
      for (let g = 0; g < groupCount; g++) {
        for (const pid of groups[g]) {
          await tx.player.update({
            where: { id: pid },
            data: { groupName: groupNames[g] },
          });
        }
        if (groups[g].length >= 2) {
          matchNumber = await createRoundRobin(
            tx,
            tournamentId,
            groups[g],
            "GROUP",
            groupNames[g],
            matchNumber,
          );
        }
      }
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "IN_PROGRESS" },
    });
  });
}

async function completeAndAdvance(
  tx: Tx,
  matchId: string,
  winnerId: string,
  p1Score: number | null,
  p2Score: number | null,
  judgeName: string | null,
) {
  const match = await tx.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  await tx.match.update({
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
    await tx.match.update({
      where: { id: match.nextMatchId },
      data: match.nextSlot === 1 ? { player1Id: winnerId } : { player2Id: winnerId },
    });
  }
}

export type ResultInput = {
  matchId: string;
  player1Score: number;
  player2Score: number;
  winnerId: string;
  judgeName: string;
};

export async function recordResult(input: ResultInput) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
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

    await completeAndAdvance(
      tx,
      input.matchId,
      input.winnerId,
      input.player1Score,
      input.player2Score,
      input.judgeName,
    );

    const t = match.tournament;

    if (t.format === "GROUP_KNOCKOUT" && match.stage === "GROUP") {
      // if all group matches done and no knockout exists yet, build it
      const remaining = await tx.match.count({
        where: { tournamentId: t.id, stage: "GROUP", status: { not: "COMPLETED" } },
      });
      const knockoutExists = await tx.match.count({
        where: { tournamentId: t.id, stage: "KNOCKOUT" },
      });
      if (remaining === 0 && knockoutExists === 0) {
        await buildKnockoutFromGroups(tx, t.id, (t.settings as Settings) ?? {});
      }
    }

    // completion check: the final knockout/elim match has no nextMatchId
    if (
      (match.stage === "KNOCKOUT" || t.format === "SINGLE_ELIM") &&
      !match.nextMatchId
    ) {
      await tx.tournament.update({
        where: { id: t.id },
        data: { status: "COMPLETED" },
      });
    }

    if (t.format === "ROUND_ROBIN") {
      const remaining = await tx.match.count({
        where: { tournamentId: t.id, status: { not: "COMPLETED" } },
      });
      if (remaining === 0) {
        await tx.tournament.update({
          where: { id: t.id },
          data: { status: "COMPLETED" },
        });
      }
    }
  });
}

async function buildKnockoutFromGroups(tx: Tx, tournamentId: string, settings: Settings) {
  const advancersPerGroup = Math.max(1, settings.advancersPerGroup ?? 2);
  const players = await tx.player.findMany({ where: { tournamentId } });
  const matches = await tx.match.findMany({
    where: { tournamentId, stage: "GROUP" },
  });

  const groupNames = [...new Set(players.map((p) => p.groupName).filter(Boolean))].sort() as string[];

  const perGroupRanked = groupNames.map((g) =>
    computeStandingsFromMatches(
      players.filter((p) => p.groupName === g),
      matches.filter((m) => m.groupName === g),
    ).slice(0, advancersPerGroup),
  );

  // rank-major ordering: all group winners, then all runners-up, ...
  const seededIds: string[] = [];
  for (let rank = 0; rank < advancersPerGroup; rank++) {
    for (const ranked of perGroupRanked) {
      if (ranked[rank]) seededIds.push(ranked[rank].playerId);
    }
  }

  if (seededIds.length >= 2) {
    const maxMatchNumber = await tx.match.aggregate({
      where: { tournamentId },
      _max: { matchNumber: true },
    });
    await createSingleElim(
      tx,
      tournamentId,
      seededIds,
      (maxMatchNumber._max.matchNumber ?? 0) + 1,
    );
  }
}
