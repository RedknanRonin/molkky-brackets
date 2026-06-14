# Mölkky Cup 🎯

A bracket-and-match website for running Mölkky tournaments.

- **Players** join with just a name — no accounts.
- **Spectators** follow the live bracket, upcoming matches, standings and progress.
- **Judges** sign in with a shared password (+ their name) and record match results
  (final score per player + winner). Their name is shown on matches they scored.
- **Organizers** sign in with an admin password to create tournaments, manage
  registration, and generate the bracket.

Supports three formats, chosen when creating a tournament:
**single elimination**, **round robin**, and **group stage + knockout**.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 7 (pg driver adapter)
· PostgreSQL. Designed to deploy on Vercel.

> This app stores its data in a dedicated `molkky` Postgres schema, so it can safely
> share a database with other apps (it never touches the `public` schema).

## Local development

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values:
   - `DATABASE_URL` — Postgres URL. Keep `?sslmode=require&schema=molkky`.
   - `ADMIN_PASSWORD`, `JUDGE_PASSWORD` — shared passwords.
   - `SESSION_SECRET` — random hex string (`openssl rand -hex 32`).
3. `npx prisma migrate dev` — applies the schema to the `molkky` schema.
4. `npm run dev` and open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to a Git repo and import it on vercel.com (or run `vercel`).
2. Add the four environment variables above in the Vercel project settings
   (Production + Preview). Use the same `DATABASE_URL` with `&schema=molkky`.
3. Deploy. The build runs `prisma migrate deploy` then `next build`; the Prisma
   client is regenerated on install via `postinstall`.

## How scoring works

Open a tournament → judges sign in → each ready match shows a **Score** button.
Tap the winner, enter both final scores, save. Winners auto-advance in knockout
brackets; standings recompute for round-robin/groups; the group stage rolls into a
knockout bracket automatically once every group match is in.
