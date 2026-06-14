import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LoginJudgeForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function JudgePage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const session = await getSession();

  if (session) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold">Judging</h1>
        <p className="text-sm text-black/60">
          Signed in as <strong>{session.name ?? "Admin"}</strong>. Open a
          tournament, then use the <em>Score</em> button on a ready match.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Go to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Judge sign in</h1>
      <p className="text-sm text-black/60">
        Enter your name and the shared judge password. Your name is shown on the
        matches you score.
      </p>
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <LoginJudgeForm redirectTo={redirectTo ?? "/"} />
      </div>
    </div>
  );
}
