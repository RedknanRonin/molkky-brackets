import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { logout } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Mölkky Tournament",
  description: "Run a Mölkky tournament: join, follow matches, and judge results.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <header className="bg-emerald-800 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="text-2xl" aria-hidden>
                🎯
              </span>
              Mölkky Cup
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {session ? (
                <>
                  <span className="rounded-full bg-emerald-700 px-3 py-1">
                    {session.role === "admin" ? "Admin" : `Judge: ${session.name}`}
                  </span>
                  <form action={logout}>
                    <button className="rounded-md bg-emerald-900/60 px-3 py-1 hover:bg-emerald-900">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/judge" className="hover:underline">
                    Judge
                  </Link>
                  <Link href="/admin" className="hover:underline">
                    Admin
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

        <footer className="border-t border-black/10 py-4 text-center text-xs text-black/50">
          Mölkky tournament tracker · first to exactly 50 wins
        </footer>
      </body>
    </html>
  );
}
