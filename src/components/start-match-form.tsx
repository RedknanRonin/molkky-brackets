"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startMatch } from "@/lib/actions";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      {pending ? "Starting…" : "Start match at this stage"}
    </button>
  );
}

export function StartMatchForm({ matchId }: { matchId: string }) {
  const [state, action] = useActionState(startMatch, {});
  return (
    <form action={action}>
      <input type="hidden" name="matchId" value={matchId} />
      <Btn />
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
