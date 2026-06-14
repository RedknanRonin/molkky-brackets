import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ScoreForm } from "@/components/forms";

export const dynamic = "force-dynamic";

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
      tournament: { select: { id: true, name: true } },
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

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href={`/t/${match.tournamentId}`}
          className="text-xs text-black/40 hover:underline"
        >
          ← {match.tournament.name}
        </Link>
        <h1 className="text-xl font-bold">Score match #{match.matchNumber}</h1>
        <p className="text-sm text-black/60">
          Tap the winner, enter both final scores, then save. Recorded as{" "}
          <strong>{session.name ?? "Admin"}</strong>.
        </p>
      </div>

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

      <p className="text-xs text-black/40">
        Mölkky reminder: a game is won by reaching <strong>exactly 50</strong>.
        Going over drops you back to 25.
      </p>
    </div>
  );
}
