import Link from "next/link";

export type PlayerRef = { id: string; name: string } | null;

export type MatchView = {
  id: string;
  stage: string;
  round: number;
  matchNumber: number;
  groupName: string | null;
  bracketSection: string | null;
  player1: PlayerRef;
  player2: PlayerRef;
  player1Score: number | null;
  player2Score: number | null;
  winnerId: string | null;
  status: string;
  judgeName: string | null;
};

function Side({
  player,
  score,
  isWinner,
}: {
  player: PlayerRef;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
        isWinner ? "font-bold text-emerald-800" : ""
      }`}
    >
      <span className="truncate">{player ? player.name : <em className="text-black/30">TBD</em>}</span>
      <span className="tabular-nums text-sm text-black/60">{score ?? ""}</span>
    </div>
  );
}

export function MatchCard({
  match,
  canJudge = false,
}: {
  match: MatchView;
  canJudge?: boolean;
}) {
  const ready = !!match.player1 && !!match.player2;
  const done = match.status === "COMPLETED";

  return (
    <div className="rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-1 text-[11px] uppercase tracking-wide text-black/40">
        <span>Match #{match.matchNumber}</span>
        <span>
          {done ? "Final" : ready ? "Ready" : "Waiting"}
        </span>
      </div>
      <div className="divide-y divide-black/5">
        <Side
          player={match.player1}
          score={match.player1Score}
          isWinner={done && match.winnerId === match.player1?.id}
        />
        <Side
          player={match.player2}
          score={match.player2Score}
          isWinner={done && match.winnerId === match.player2?.id}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-black/50">
        <span>{match.judgeName ? `Judge: ${match.judgeName}` : " "}</span>
        {canJudge && ready && (
          <Link
            href={`/match/${match.id}`}
            className="rounded bg-emerald-700 px-2 py-1 font-semibold text-white hover:bg-emerald-800"
          >
            {done ? "Edit" : "Score"}
          </Link>
        )}
      </div>
    </div>
  );
}

function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

function BracketSection({
  sectionMatches,
  canJudge,
}: {
  sectionMatches: MatchView[];
  canJudge: boolean;
}) {
  const rounds = [...new Set(sectionMatches.map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  const totalRounds = rounds.length;
  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map((r, idx) => (
        <div key={r} className="flex min-w-[15rem] flex-col">
          <h4 className="mb-3 text-sm font-semibold text-black/60">
            {roundName(idx + 1, totalRounds)}
          </h4>
          <div className="flex flex-1 flex-col justify-around gap-4">
            {sectionMatches
              .filter((m) => m.round === r)
              .sort((a, b) => a.matchNumber - b.matchNumber)
              .map((m) => (
                <MatchCard key={m.id} match={m} canJudge={canJudge} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Bracket({
  matches,
  canJudge = false,
}: {
  matches: MatchView[];
  canJudge?: boolean;
}) {
  const knockout = matches.filter((m) => m.stage === "KNOCKOUT");
  if (knockout.length === 0) {
    return <p className="text-sm text-black/50">Bracket not generated yet.</p>;
  }

  // Double-elim: any match has bracketSection set
  const hasSection = knockout.some((m) => m.bracketSection);
  if (hasSection) {
    const sectionDefs: { key: string; label: string }[] = [
      { key: "WB", label: "Winners Bracket" },
      { key: "LB", label: "Losers Bracket" },
      { key: "GF", label: "Grand Final" },
    ];
    return (
      <div className="space-y-8">
        {sectionDefs.map(({ key, label }) => {
          const sectionMatches = knockout.filter((m) => m.bracketSection === key);
          if (sectionMatches.length === 0) return null;
          return (
            <div key={key}>
              <h3 className="mb-3 text-base font-semibold">{label}</h3>
              <BracketSection sectionMatches={sectionMatches} canJudge={canJudge} />
            </div>
          );
        })}
      </div>
    );
  }

  // Original flat single-elim layout
  const rounds = [...new Set(knockout.map((m) => m.round))].sort((a, b) => a - b);
  const totalRounds = rounds.length;

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((r) => (
        <div key={r} className="flex min-w-[15rem] flex-col">
          <h3 className="mb-3 text-sm font-semibold text-black/60">
            {roundName(r, totalRounds)}
          </h3>
          <div className="flex flex-1 flex-col justify-around gap-4">
            {knockout
              .filter((m) => m.round === r)
              .sort((a, b) => a.matchNumber - b.matchNumber)
              .map((m) => (
                <MatchCard key={m.id} match={m} canJudge={canJudge} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StandingsTable({
  rows,
  title,
}: {
  rows: {
    playerId: string;
    name: string;
    played: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    diff: number;
  }[];
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
      {title && (
        <div className="border-b border-black/5 bg-black/[0.02] px-3 py-2 text-sm font-semibold">
          {title}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-black/40">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-2 py-2 text-center">P</th>
            <th className="px-2 py-2 text-center">W</th>
            <th className="px-2 py-2 text-center">L</th>
            <th className="px-2 py-2 text-center">+/−</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((r, i) => (
            <tr key={r.playerId}>
              <td className="px-3 py-2 text-black/40">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-2 py-2 text-center tabular-nums">{r.played}</td>
              <td className="px-2 py-2 text-center tabular-nums font-semibold text-emerald-700">
                {r.wins}
              </td>
              <td className="px-2 py-2 text-center tabular-nums">{r.losses}</td>
              <td className="px-2 py-2 text-center tabular-nums">
                {r.diff > 0 ? `+${r.diff}` : r.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
