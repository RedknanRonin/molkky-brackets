"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordThrow, type FormState } from "@/lib/actions";

function SubmitBtn({ score }: { score: number | null }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || score === null}
      className="w-full rounded-md bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      {pending ? "Recording…" : score !== null ? `Record +${score} pts` : "Tap a score above"}
    </button>
  );
}

export function ThrowForm({
  matchId,
  playerName,
}: {
  matchId: string;
  playerName: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(recordThrow, {});
  const [score, setScore] = useState<number | null>(null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="score" value={score ?? ""} />

      <p className="text-sm font-semibold text-emerald-800">
        🎯 {playerName}&apos;s throw
      </p>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 13 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setScore(i)}
            className={`rounded-md border py-2 text-sm font-semibold transition ${
              score === i
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-black/10 bg-white hover:border-emerald-400"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitBtn score={score} />
    </form>
  );
}
