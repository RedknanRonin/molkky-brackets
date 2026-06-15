import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { CreateTournamentForm } from "@/components/forms";
import { MatchCard, type MatchView } from "@/components/match";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIM: "Single elimination",
  ROUND_ROBIN: "Round robin",
  GROUP_KNOCKOUT: "Groups + knockout",
  DOUBLE_ELIM: "Double elimination",
};

const STATUS_BADGE: Record<string, string> = {
  REGISTRATION: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-black/10 text-black/60",
};

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

export default async function HomePage() {
  const [session, admin, tournaments, activeTournament] = await Promise.all([
    getSession(),
    isAdmin(),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { players: true } } },
    }),
    prisma.tournament.findFirst({
      where: { status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
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
    }),
  ]);

  const canJudge = !!session;

  let stage1: MatchView | undefined;
  let stage2: MatchView | undefined;
  let queue: MatchView[] = [];

  if (activeTournament) {
    const allMatches: MatchView[] = activeTournament.matches.map((m) => ({
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
    stage1 = playing[0] ?? pending[0];
    stage2 = playing[1] ?? (playing[0] ? pending[0] : pending[1]);
    const shownIds = new Set([stage1?.id, stage2?.id].filter(Boolean));
    queue = pending.filter((m) => !shownIds.has(m.id));
  }

  return (
    <div className="space-y-8">
      {/* Live section — shown when a tournament is in progress */}
      {activeTournament && (
        <section className="space-y-4">
          <AutoRefresh intervalMs={4000} />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                Live
              </p>
              <h1 className="text-2xl font-bold">{activeTournament.name}</h1>
            </div>
            <Link
              href={`/t/${activeTournament.id}`}
              className="shrink-0 text-sm text-emerald-700 underline"
            >
              Full bracket →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StageCard stageNum={1} match={stage1} canJudge={canJudge} />
            <StageCard stageNum={2} match={stage2} canJudge={canJudge} />
          </div>
          {queue.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-black/40">
                Upcoming
              </h2>
              <div className="space-y-2">
                {queue.map((m) => (
                  <MatchCard key={m.id} match={m} canJudge={canJudge} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <p className="text-sm text-black/60">
          Pick a tournament to join, follow matches, and see the bracket.
        </p>
      </section>

      {admin && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h2 className="mb-3 font-semibold">Create a tournament</h2>
          <CreateTournamentForm />
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {tournaments.length === 0 && (
          <p className="text-sm text-black/50">No tournaments yet.</p>
        )}
        {tournaments.map((t) => (
          <Link
            key={t.id}
            href={`/t/${t.id}`}
            className="block rounded-xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{t.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}
              >
                {t.status.replace("_", " ").toLowerCase()}
              </span>
            </div>
            <p className="mt-1 text-sm text-black/60">
              {FORMAT_LABEL[t.format]} · {t._count.players} players
            </p>
          </Link>
        ))}
      </section>

    </div>
  );
}
