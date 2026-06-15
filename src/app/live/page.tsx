import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MatchCard, type MatchView } from "@/components/match";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

function formatLabel(format: string) {
  switch (format) {
    case "SINGLE_ELIM": return "Single Elimination";
    case "ROUND_ROBIN": return "Round Robin";
    case "GROUP_KNOCKOUT": return "Group Stage + Knockout";
    default: return format;
  }
}

function StageCard({
  stageNum,
  match,
  canJudge,
}: {
  stageNum: number;
  match: MatchView | undefined;
  canJudge: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-emerald-700/30 bg-white p-4 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-700">
        Stage {stageNum}
      </h2>
      {match ? (
        <>
          <div className="text-xs font-medium uppercase tracking-wide text-black/40">
            {match.status === "IN_PROGRESS" ? "Now playing" : "Up next"}
          </div>
          <MatchCard match={match} canJudge={canJudge} />
        </>
      ) : (
        <p className="text-sm text-black/40 italic">No match scheduled</p>
      )}
    </div>
  );
}

export default async function LivePage() {
  const session = await getSession();
  const canJudge = !!session;

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      matches: {
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
        include: {
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } },
        },
        where: {
          status: { not: "COMPLETED" },
          player1Id: { not: null },
          player2Id: { not: null },
        },
      },
    },
  });

  if (!tournament) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center space-y-2">
        <p className="text-lg font-semibold text-black/60">No active tournament</p>
        <p className="text-sm text-black/40">
          Start a tournament to see live match tracking here.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-emerald-700 underline">
          Home
        </Link>
      </div>
    );
  }

  // Map to MatchView shape
  const allMatches: MatchView[] = tournament.matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    round: m.round,
    matchNumber: m.matchNumber,
    groupName: m.groupName,
    bracketSection: m.bracketSection,
    player1: m.player1 ? { id: m.player1.id, name: m.player1.name } : null,
    player2: m.player2 ? { id: m.player2.id, name: m.player2.name } : null,
    player1Score: m.player1Score,
    player2Score: m.player2Score,
    winnerId: m.winnerId,
    status: m.status,
    judgeName: m.judgeName,
  }));

  const playing = allMatches.filter((m) => m.status === "IN_PROGRESS");
  const pending = allMatches.filter((m) => m.status === "PENDING");

  // Stage assignments: prefer IN_PROGRESS matches, fill with PENDING
  const stage1 = playing[0] ?? pending[0];
  const stage2 = playing[1] ?? (playing[0] ? pending[0] : pending[1]);

  // Queue: everything not shown in a stage card
  const shownIds = new Set([stage1?.id, stage2?.id].filter(Boolean));
  const queue = pending.filter((m) => !shownIds.has(m.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AutoRefresh intervalMs={4000} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Live
          </p>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-black/50">{formatLabel(tournament.format)}</p>
        </div>
        <Link
          href={`/t/${tournament.id}`}
          className="mt-1 shrink-0 text-sm text-emerald-700 underline"
        >
          Back to tournament
        </Link>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StageCard stageNum={1} match={stage1} canJudge={canJudge} />
        <StageCard stageNum={2} match={stage2} canJudge={canJudge} />
      </div>

      {/* Upcoming queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-black/40">
            Upcoming matches
          </h2>
          <div className="space-y-2">
            {queue.map((m) => (
              <MatchCard key={m.id} match={m} canJudge={canJudge} />
            ))}
          </div>
        </div>
      )}

      {allMatches.length === 0 && (
        <p className="text-center text-sm text-black/40 italic py-8">
          All matches completed or no matches with assigned players.
        </p>
      )}
    </div>
  );
}
