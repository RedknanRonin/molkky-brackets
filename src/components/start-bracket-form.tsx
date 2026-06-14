"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startTournament, type FormState } from "@/lib/actions";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      {pending ? "Generating…" : "Generate bracket & start"}
    </button>
  );
}

export function StartBracketForm({
  tournamentId,
  playerCount,
}: {
  tournamentId: string;
  playerCount: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    startTournament,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <SubmitButton disabled={playerCount < 2} />
      {playerCount < 2 && (
        <span className="text-xs text-black/50">Need at least 2 players.</span>
      )}
      {state?.error && (
        <p className="w-full text-sm font-medium text-red-600">{state.error}</p>
      )}
    </form>
  );
}
