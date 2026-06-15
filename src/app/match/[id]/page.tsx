import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ScoreForm } from "@/components/forms";
import { StartMatchForm } from "@/components/start-match-form";
import { ThrowForm } from "@/components/throw-form";

export const dynamic = "force-dynamic";

function runningTotal(scores: number[]): number {
  let total = 0;
  for (const s of scores) {
    total += s;
    if (total > 50) total = 25;
  }
  return total;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/judge?redirectTo=/match/${id}`);

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      tournament: { select: { id: true, name: true, trackThrows: true } },
      throws: { orderBy: { throwNumber: "asc" } },
    },
  });

  if (!match) notFound();

  if (!match.player1 || !match.player2) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-xl font-bold">Match not ready</h1>
        <p className="text-sm text-black/60">
          Both players must be decided before this match can be scored.
        </p>
        <Link
          href={`/t/${match.tournamentId}`}
          className="text-sm text-emerald-700 underline"
        >
          Back to tournament
        </Link>
      </div>
    );
  }

  const isPending = match.status === "PENDING";
  const isInProgress = match.status === "IN_PROGRESS";
  const isCompleted = match.status === "COMPLETED";
  const { trackThrows } = match.tournament;

  // Compute per-player throw histories and totals
  const p1Throws = match.throws.filter((t) => t.playerId === match.player1!.id);
  const p2Throws = match.throws.filter((t) => t.playerId === match.player2!.id);

  const p1RunningTotals: number[] = [];
  let acc = 0;
  for (const t of p1Throws) {
    acc += t.score;
    if (acc > 50) acc = 25;
    p1RunningTotals.push(acc);
  }

  const p2RunningTotals: number[] = [];
  acc = 0;
  for (const t of p2Throws) {
    acc += t.score;
    if (acc > 50) acc = 25;
    p2RunningTotals.push(acc);
  }

  const p1Total = p1RunningTotals.at(-1) ?? 0;
  const p2Total = p2RunningTotals.at(-1) ?? 0;

  // Whose turn next (1-indexed throw number)
  const nextThrowNumber = match.throws.length + 1;
  const nextPlayerId = nextThrowNumber % 2 === 1 ? match.player1.id : match.player2.id;
  const nextPlayerName =
    nextPlayerId === match.player1.id ? match.player1.name : match.player2.name;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href={`/t/${match.tournamentId}`}
          className="text-xs text-black/40 hover:underline"
        >
          ← {match.tournament.name}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Match #{match.matchNumber}</h1>
          {isInProgress && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              In progress
            </span>
          )}
          {isCompleted && (
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-black/50">
              Completed
            </span>
          )}
        </div>
      </div>

      {isPending && (
        <div className="rounded-xl border border-black/10 bg-white p-4 space-y-3">
          <p className="text-sm text-black/60">
            {match.player1.name} vs {match.player2.name} — waiting to start.
          </p>
          <StartMatchForm matchId={match.id} />
        </div>
      )}

      {/* Throw-tracking mode */}
      {trackThrows && (isInProgress || isCompleted) && (
        <>
          {/* Live scoreboard */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { player: match.player1, total: p1Total, isNext: nextPlayerId === match.player1.id },
              { player: match.player2, total: p2Total, isNext: nextPlayerId === match.player2.id },
            ].map(({ player, total, isNext }) => (
              <div
                key={player.id}
                className={`rounded-xl border-2 p-4 text-center transition ${
                  isInProgress && isNext
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-black/10 bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  {player.name}
                </p>
                <p className="text-4xl font-bold tabular-nums">{total}</p>
                <p className="text-xs text-black/40">/ 50</p>
                {isInProgress && isNext && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">← throwing</p>
                )}
              </div>
            ))}
          </div>

          {/* Throw input — only when in progress */}
          {isInProgress && (
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <ThrowForm matchId={match.id} playerName={nextPlayerName} />
            </div>
          )}

          {/* Throw history table */}
          {match.throws.length > 0 && (
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
              <h2 className="text-sm font-semibold">Throw history</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { player: match.player1, playerThrows: p1Throws, runningTotals: p1RunningTotals },
                  { player: match.player2, playerThrows: p2Throws, runningTotals: p2RunningTotals },
                ].map(({ player, playerThrows, runningTotals }) => (
                  <div key={player.id}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/50">
                      {player.name}
                    </p>
                    <div className="space-y-0.5">
                      {playerThrows.map((t, idx) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded px-2 py-1 text-xs odd:bg-black/[0.03]"
                        >
                          <span className="text-black/40">#{idx + 1}</span>
                          <span
                            className={`font-semibold ${
                              t.score === 0 ? "text-red-500" : "text-black"
                            }`}
                          >
                            +{t.score}
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              runningTotals[idx] === 50
                                ? "text-emerald-700"
                                : runningTotals[idx] === 25 && idx > 0 && runningTotals[idx - 1] > 25
                                ? "text-amber-600"
                                : "text-black/70"
                            }`}
                          >
                            {runningTotals[idx]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Standard scoring mode */}
      {!trackThrows && (isInProgress || isCompleted) && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <ScoreForm
            matchId={match.id}
            tournamentId={match.tournamentId}
            player1={match.player1}
            player2={match.player2}
            initialP1={match.player1Score}
            initialP2={match.player2Score}
            initialWinnerId={match.winnerId}
          />
        </div>
      )}

      <p className="text-xs text-black/40">
        Mölkky: reach <strong>exactly 50</strong> to win. Going over resets you to 25. Three
        consecutive misses = elimination.
      </p>
    </div>
  );
}
