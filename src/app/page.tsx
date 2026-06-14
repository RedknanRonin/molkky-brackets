import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { CreateTournamentForm } from "@/components/forms";

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIM: "Single elimination",
  ROUND_ROBIN: "Round robin",
  GROUP_KNOCKOUT: "Groups + knockout",
};

const STATUS_BADGE: Record<string, string> = {
  REGISTRATION: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-black/10 text-black/60",
};

export default async function HomePage() {
  const [admin, tournaments] = await Promise.all([
    isAdmin(),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { players: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
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

      {!admin && (
        <p className="text-xs text-black/40">
          Organizing?{" "}
          <Link href="/admin" className="underline">
            Sign in as admin
          </Link>{" "}
          to create a tournament.
        </p>
      )}
    </div>
  );
}
