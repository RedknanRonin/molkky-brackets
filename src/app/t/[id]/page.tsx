import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  startTournament,
  removePlayer,
  deleteTournament,
} from "@/lib/actions";
import { JoinForm } from "@/components/forms";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  Bracket,
  MatchCard,
  StandingsTable,
  type MatchView,
} from "@/components/match";
import { computeStandingsFromMatches } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIM: "Single elimination",
  ROUND_ROBIN: "Round robin",
  GROUP_KNOCKOUT: "Groups + knockout",
};

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, t] = await Promise.all([
    getSession(),
    prisma.tournament.findUnique({
      where: { id },
      include: {
        players: { orderBy: { createdAt: "asc" } },
        matches: {
          orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  if (!t) notFound();

  const canJudge = !!session;
  const isAdmin = session?.role === "admin";

  const matches: MatchView[] = t.matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    round: m.round,
    matchNumber: m.matchNumber,
    groupName: m.groupName,
    player1: m.player1,
    player2: m.player2,
    player1Score: m.player1Score,
    player2Score: m.player2Score,
    winnerId: m.winnerId,
    status: m.status,
    judgeName: m.judgeName,
  }));

  const upcoming = matches.filter(
    (m) => m.status !== "COMPLETED" && m.player1 && m.player2,
  );
  const results = matches
    .filter((m) => m.status === "COMPLETED")
    .reverse();

  const standings = computeStandingsFromMatches(t.players, t.matches);

  // Champion: standings leader for round robin, else the final knockout match winner.
  const playerName = new Map(t.players.map((p) => [p.id, p.name]));
  let championName: string | undefined;
  if (t.status === "COMPLETED") {
    if (t.format === "ROUND_ROBIN") {
      championName = standings[0]?.name;
    } else {
      const finalMatch = matches
        .filter((m) => m.stage === "KNOCKOUT")
        .sort((a, b) => b.round - a.round)[0];
      championName = finalMatch?.winnerId
        ? playerName.get(finalMatch.winnerId)
        : undefined;
    }
  }

  return (
    <div className="space-y-8">
      {t.status === "IN_PROGRESS" && <AutoRefresh />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-black/40 hover:underline">
            ← All tournaments
          </Link>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-black/60">
            {FORMAT_LABEL[t.format]} · {t.players.length} players ·{" "}
            {t.status.replace("_", " ").toLowerCase()}
          </p>
        </div>
        {!session && (
          <Link
            href={`/judge?redirectTo=/t/${t.id}`}
            className="rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Judge sign in
          </Link>
        )}
      </header>

      {t.status === "COMPLETED" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
          <p className="text-sm uppercase tracking-wide text-amber-700">Champion</p>
          <p className="text-2xl font-bold">🏆 {championName ?? "—"}</p>
        </div>
      )}

      {/* Registration view */}
      {t.status === "REGISTRATION" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h2 className="mb-2 font-semibold">Join this tournament</h2>
            <JoinForm tournamentId={t.id} />
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-4">
            <h2 className="mb-3 font-semibold">
              Players ({t.players.length})
            </h2>
            {t.players.length === 0 ? (
              <p className="text-sm text-black/50">No players yet — be the first!</p>
            ) : (
              <ul className="grid gap-1 sm:grid-cols-2">
                {t.players.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-black/[0.03] px-3 py-1.5 text-sm"
                  >
                    <span>{p.name}</span>
                    {isAdmin && (
                      <form action={removePlayer}>
                        <input type="hidden" name="playerId" value={p.id} />
                        <input type="hidden" name="tournamentId" value={t.id} />
                        <button className="text-xs text-red-600 hover:underline">
                          remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <form action={startTournament} className="flex items-center gap-3">
              <input type="hidden" name="tournamentId" value={t.id} />
              <button
                disabled={t.players.length < 2}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Generate bracket &amp; start
              </button>
              {t.players.length < 2 && (
                <span className="text-xs text-black/50">Need at least 2 players.</span>
              )}
            </form>
          )}
        </section>
      )}

      {/* Bracket / standings */}
      {t.status !== "REGISTRATION" && (
        <>
          {(t.format === "SINGLE_ELIM" || t.format === "GROUP_KNOCKOUT") &&
            matches.some((m) => m.stage === "KNOCKOUT") && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Bracket</h2>
                <Bracket matches={matches} canJudge={canJudge} />
              </section>
            )}

          {t.format === "ROUND_ROBIN" && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Standings</h2>
              <StandingsTable rows={standings} />
            </section>
          )}

          {t.format === "GROUP_KNOCKOUT" && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Groups</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...new Set(t.players.map((p) => p.groupName).filter(Boolean))]
                  .sort()
                  .map((g) => (
                    <StandingsTable
                      key={g}
                      title={`Group ${g}`}
                      rows={computeStandingsFromMatches(
                        t.players.filter((p) => p.groupName === g),
                        t.matches.filter((m) => m.groupName === g),
                      )}
                    />
                  ))}
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold">
                Upcoming matches ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-black/50">No matches ready right now.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} canJudge={canJudge} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold">Results ({results.length})</h2>
              {results.length === 0 ? (
                <p className="text-sm text-black/50">No results yet.</p>
              ) : (
                <div className="space-y-3">
                  {results.map((m) => (
                    <MatchCard key={m.id} match={m} canJudge={canJudge} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {isAdmin && (
        <section className="border-t border-black/10 pt-4">
          <form action={deleteTournament}>
            <input type="hidden" name="tournamentId" value={t.id} />
            <button className="text-xs text-red-600 hover:underline">
              Delete tournament
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
