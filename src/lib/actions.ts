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
  if (!["SINGLE_ELIM", "ROUND_ROBIN", "GROUP_KNOCKOUT"].includes(format)) {
    return { error: "Pick a format." };
  }

  const settings: Record<string, number> = {};
  if (format === "GROUP_KNOCKOUT") {
    settings.groupCount = Math.max(1, Number(str(fd, "groupCount") || "2"));
    settings.advancersPerGroup = Math.max(
      1,
      Number(str(fd, "advancersPerGroup") || "2"),
    );
  }

  const t = await prisma.tournament.create({
    data: { name, format, settings },
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

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return { error: "Tournament not found." };
  if (t.status !== "REGISTRATION") return { error: "Registration is closed." };

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
  return {};
}
