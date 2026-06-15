"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createTournament,
  joinTournament,
  loginAdmin,
  loginJudge,
  submitResult,
  type FormState,
} from "@/lib/actions";

const initial: FormState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";
const labelClass = "block text-sm font-medium mb-1";
const errorClass = "text-sm text-red-600";

function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      }
    >
      {pending ? "…" : children}
    </button>
  );
}

export function LoginAdminForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(loginAdmin, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />
      <div>
        <label className={labelClass}>Admin password</label>
        <input className={inputClass} type="password" name="password" autoFocus />
      </div>
      {state.error && <p className={errorClass}>{state.error}</p>}
      <SubmitButton>Sign in as admin</SubmitButton>
    </form>
  );
}

export function LoginJudgeForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(loginJudge, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />
      <div>
        <label className={labelClass}>Your name</label>
        <input className={inputClass} name="name" placeholder="e.g. Aleksi" autoFocus />
      </div>
      <div>
        <label className={labelClass}>Judge password</label>
        <input className={inputClass} type="password" name="password" />
      </div>
      {state.error && <p className={errorClass}>{state.error}</p>}
      <SubmitButton>Start judging</SubmitButton>
    </form>
  );
}

export function CreateTournamentForm() {
  const [state, action] = useActionState(createTournament, initial);
  const [format, setFormat] = useState("SINGLE_ELIM");
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className={labelClass}>Tournament name</label>
        <input className={inputClass} name="name" placeholder="CERN SUMMER MÖLKKY" />
      </div>  
      <div>
        <label className={labelClass}>Format</label>
        <select
          className={inputClass}
          name="format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="SINGLE_ELIM">Single elimination</option>
          <option value="ROUND_ROBIN">Round robin</option>
          <option value="GROUP_KNOCKOUT">Group stage + knockout</option>
          <option value="DOUBLE_ELIM">Double elimination</option>
        </select>
      </div>
      {format === "GROUP_KNOCKOUT" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Number of groups</label>
            <input
              className={inputClass}
              type="number"
              name="groupCount"
              min={1}
              defaultValue={2}
            />
          </div>
          <div>
            <label className={labelClass}>Advance per group</label>
            <input
              className={inputClass}
              type="number"
              name="advancersPerGroup"
              min={1}
              defaultValue={2}
            />
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" name="trackThrows" className="rounded border-black/20 accent-emerald-700" />
        <span className="text-sm">Track individual throws (auto-ends at 50 pts or 3 misses)</span>
      </label>

      {state.error && <p className={errorClass}>{state.error}</p>}
      <SubmitButton>Create tournament</SubmitButton>
    </form>
  );
}

export function JoinForm({ tournamentId }: { tournamentId: string }) {
  const [state, action] = useActionState(joinTournament, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <div className="flex-1 min-w-[12rem]">
        <label className={labelClass}>Your name</label>
        <input className={inputClass} name="name" placeholder="Enter your name to join" />
      </div>
      <SubmitButton>Join</SubmitButton>
      {state.error && <p className={`${errorClass} w-full`}>{state.error}</p>}
    </form>
  );
}

export function ScoreForm({
  matchId,
  tournamentId,
  player1,
  player2,
  initialP1,
  initialP2,
  initialWinnerId,
}: {
  matchId: string;
  tournamentId: string;
  player1: { id: string; name: string };
  player2: { id: string; name: string };
  initialP1?: number | null;
  initialP2?: number | null;
  initialWinnerId?: string | null;
}) {
  const [state, action] = useActionState(submitResult, initial);
  const [winnerId, setWinnerId] = useState(initialWinnerId ?? "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="winnerId" value={winnerId} />

      <div className="grid grid-cols-2 gap-4">
        {[
          { p: player1, scoreName: "player1Score", init: initialP1 },
          { p: player2, scoreName: "player2Score", init: initialP2 },
        ].map(({ p, scoreName, init }) => {
          const selected = winnerId === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setWinnerId(p.id)}
              className={`rounded-lg border-2 p-4 text-left transition ${
                selected
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-black/10 bg-white hover:border-emerald-300"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                {selected && (
                  <span className="text-xs font-bold text-emerald-700">WINNER</span>
                )}
              </div>
              <label className="block text-xs text-black/50">Final score</label>
              <input
                className={inputClass}
                type="number"
                name={scoreName}
                min={0}
                max={50}
                defaultValue={init ?? undefined}
                onClick={(e) => e.stopPropagation()}
              />
            </button>
          );
        })}
      </div>

      {state.error && <p className={errorClass}>{state.error}</p>}
      <SubmitButton className="w-full rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
        Save result
      </SubmitButton>
    </form>
  );
}
