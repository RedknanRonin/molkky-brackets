import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LoginAdminForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();

  if (session?.role === "admin") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-sm text-black/60">
          You&apos;re signed in as admin. Create tournaments from the home page,
          then open a tournament to manage registration and start the bracket.
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
      <h1 className="text-xl font-bold">Admin sign in</h1>
      <p className="text-sm text-black/60">
        Organizers create and manage tournaments. Enter the admin password.
      </p>
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <LoginAdminForm redirectTo="/" />
      </div>
    </div>
  );
}
