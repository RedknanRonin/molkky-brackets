"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  checkAdminPassword,
  checkJudgePassword,
  clearSession,
  getSession,
  setSession,
} from "@/lib/auth";
import { generateBracket, recordResult } from "@/lib/tournament";
import type { TournamentFormat } from "@/generated/prisma/client";

export type FormState = { error?: string };

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---------- auth ----------

export async function loginAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const pw = str(fd, "password");
  if (!checkAdminPassword(pw)) return { error: "Wrong admin password." };
  await setSession({ role: "admin" });
  redirect(str(fd, "redirectTo") || "/");
}

export async function loginJudge(_prev: FormState, fd: FormData): Promise<FormState> {
  const pw = str(fd, "password");
  const name = str(fd, "name");
  if (!name) return { error: "Enter your name." };
  if (!checkJudgePassword(pw)) return { error: "Wrong judge password." };
  await setSession({ role: "judge", name });
  redirect(str(fd, "redirectTo") || "/");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

// ---------- tournaments ----------

export async function createTournament(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  if ((await getSession())?.role !== "admin") return { error: "Admins only." };

  const name = str(fd, "name");
  const format = str(fd, "format") as TournamentFormat;
  if (!name) return { error: "Enter a tournament name." };
  if (!["SINGLE_ELIM", "ROUND_ROBIN", "GROUP_KNOCKOUT", "DOUBLE_ELIM"].includes(format)) {
    return { error: "Pick a format." };
  }

  const trackThrows = fd.get("trackThrows") === "on";
  const settings: Record<string, number> = {};
  if (format === "GROUP_KNOCKOUT") {
    settings.groupCount = Math.max(1, Number(str(fd, "groupCount") || "2"));
    settings.advancersPerGroup = Math.max(
      1,
      Number(str(fd, "advancersPerGroup") || "2"),
    );
  }

  const t = await prisma.tournament.create({
    data: { name, format, settings, trackThrows },
  });
  revalidatePath("/");
  redirect(`/t/${t.id}`);
}

export async function joinTournament(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const tournamentId = str(fd, "tournamentId");
  const name = str(fd, "name");
  if (!name) return { error: "Enter your name." };

  const session = await getSession();
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return { error: "Tournament not found." };
  if (t.status === "COMPLETED") return { error: "Tournament is finished." };
  if (t.status === "IN_PROGRESS" && !session) return { error: "Only judges can add players during a live tournament." };

  const existing = await prisma.player.findFirst({
    where: { tournamentId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return { error: "That name is already taken." };

  await prisma.player.create({ data: { tournamentId, name } });
  revalidatePath(`/t/${tournamentId}`);
  return {};
}

export async function startTournament(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  if ((await getSession())?.role !== "admin") return { error: "Admins only." };
  const id = str(fd, "tournamentId");
  try {
    await generateBracket(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate bracket." };
  }
  revalidatePath(`/t/${id}`);
  redirect(`/t/${id}`);
}

export async function removePlayer(fd: FormData) {
  if ((await getSession())?.role !== "admin") throw new Error("Admins only");
  const id = str(fd, "playerId");
  const tournamentId = str(fd, "tournamentId");
  await prisma.player.delete({ where: { id } });
  revalidatePath(`/t/${tournamentId}`);
}

export async function deleteTournament(fd: FormData) {
  if ((await getSession())?.role !== "admin") throw new Error("Admins only");
  const id = str(fd, "tournamentId");
  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

// ---------- scoring ----------

export async function submitResult(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Log in as a judge first." };

  const matchId = str(fd, "matchId");
  const tournamentId = str(fd, "tournamentId");
  const winnerId = str(fd, "winnerId");
  const p1 = Number(str(fd, "player1Score"));
  const p2 = Number(str(fd, "player2Score"));

  if (!winnerId) return { error: "Select the winner." };
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0) {
    return { error: "Enter valid scores." };
  }

  try {
    await recordResult({
      matchId,
      player1Score: p1,
      player2Score: p2,
      winnerId,
      judgeName: session.name ?? "Judge",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save result." };
  }

  revalidatePath(`/t/${tournamentId}`);
  revalidatePath(`/match/${matchId}`);
  redirect(`/t/${tournamentId}`);
}

// ---------- throw tracking ----------

function runningTotal(scores: number[]): number {
  let total = 0;
  for (const s of scores) {
    total += s;
    if (total > 50) total = 25;
  }
  return total;
}

function consecutiveMisses(scores: number[]): number {
  let count = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] === 0) count++;
    else break;
  }
  return count;
}

export async function recordThrow(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Log in as a judge first." };

  const matchId = str(fd, "matchId");
  const score = Number(str(fd, "score"));

  if (!Number.isInteger(score) || score < 0 || score > 12) {
    return { error: "Score must be 0–12." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, trackThrows: true } },
      throws: { orderBy: { throwNumber: "asc" } },
    },
  });

  if (!match) return { error: "Match not found." };
  if (!match.tournament.trackThrows) return { error: "Throw tracking not enabled." };
  if (match.status === "COMPLETED") return { error: "Match is already completed." };
  if (!match.player1Id || !match.player2Id) return { error: "Players not assigned." };

  const throwNumber = match.throws.length + 1;
  // Odd throw numbers go to player 1, even to player 2
  const playerId = throwNumber % 2 === 1 ? match.player1Id : match.player2Id;

  await prisma.throw.create({ data: { matchId, playerId, score, throwNumber } });

  const allThrows = [...match.throws, { playerId, score }];
  const p1Scores = allThrows.filter((t) => t.playerId === match.player1Id).map((t) => t.score);
  const p2Scores = allThrows.filter((t) => t.playerId === match.player2Id).map((t) => t.score);

  const p1Total = runningTotal(p1Scores);
  const p2Total = runningTotal(p2Scores);

  let winnerId: string | null = null;
  if (p1Total === 50) winnerId = match.player1Id;
  else if (p2Total === 50) winnerId = match.player2Id;
  else if (consecutiveMisses(p1Scores) >= 3) winnerId = match.player2Id;
  else if (consecutiveMisses(p2Scores) >= 3) winnerId = match.player1Id;

  if (winnerId) {
    await recordResult({
      matchId,
      player1Score: p1Total,
      player2Score: p2Total,
      winnerId,
      judgeName: session.name ?? "Judge",
    });
    revalidatePath(`/t/${match.tournamentId}`);
    revalidatePath(`/match/${matchId}`);
    redirect(`/t/${match.tournamentId}`);
  }

  revalidatePath(`/match/${matchId}`);
  return {};
}

// ---------- live stage ----------

export async function startMatch(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Log in as a judge first." };
  const matchId = str(fd, "matchId");
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "IN_PROGRESS" },
  });
  revalidatePath("/live");
  revalidatePath(`/match/${matchId}`);
  return {};
}
