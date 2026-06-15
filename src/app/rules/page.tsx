export default function RulesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-emerald-800">
        🎯 Mölkky Rules
      </h1>

      {/* Objective */}
      <section className="rounded-xl border border-black/10 bg-white p-6 space-y-2">
        <h2 className="text-2xl font-bold text-emerald-800">Objective</h2>
        <p className="text-sm text-black/60">
          Be the first player or team to score <strong className="text-black/80">exactly 50 points</strong>.
          Score too many and your score drops — strategy matters as much as aim.
        </p>
      </section>

      {/* Equipment */}
      <section className="rounded-xl border border-black/10 bg-white p-6 space-y-4">
        <h2 className="text-2xl font-bold text-emerald-800">Equipment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="text-lg font-semibold text-emerald-900">The Mölkky</h3>
            <p className="mt-1 text-sm text-black/60">
              A wooden throwing pin. Thrown <strong className="text-black/80">underarm</strong> from behind
              the throwing line, which is roughly <strong className="text-black/80">3–4 metres</strong> from
              the skittles.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="text-lg font-semibold text-emerald-900">The Skittles</h3>
            <p className="mt-1 text-sm text-black/60">
              12 numbered pins (1–12) arranged in a <strong className="text-black/80">triangle formation</strong> at
              the start of the game. Fallen skittles stand back up where they fell, so the formation spreads
              out over time.
            </p>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="rounded-xl border border-black/10 bg-white p-6 space-y-4">
        <h2 className="text-2xl font-bold text-emerald-800">Scoring</h2>
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">1</span>
            <p className="text-sm text-black/60">
              Knock over <strong className="text-black/80">exactly 1 skittle</strong> → score its number
              (e.g. toppling pin 7 scores 7 points).
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">2</span>
            <p className="text-sm text-black/60">
              Knock over <strong className="text-black/80">2 or more skittles</strong> → score the
              <em> count</em> of skittles knocked (e.g. knock over 4 skittles = 4 points, regardless of their numbers).
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">3</span>
            <p className="text-sm text-black/60">
              Knocked skittles are <strong className="text-black/80">stood back up where they fell</strong> —
              the field spreads out as the game progresses.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">4</span>
            <p className="text-sm text-black/60">
              Reach <strong className="text-black/80">exactly 50</strong> → you win! 🏆
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">!</span>
            <p className="text-sm text-black/60">
              Go <strong className="text-black/80">over 50</strong> → your score drops back to{" "}
              <strong className="text-black/80">25</strong>. Stay calm and aim carefully!
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">✕</span>
            <p className="text-sm text-black/60">
              Miss <strong className="text-black/80">3 throws in a row</strong> → you are{" "}
              <strong className="text-black/80">eliminated</strong> from the game.
            </p>
          </li>
        </ul>
      </section>

      {/* Order of play */}
      <section className="rounded-xl border border-black/10 bg-white p-6 space-y-2">
        <h2 className="text-2xl font-bold text-emerald-800">Order of Play</h2>
        <p className="text-sm text-black/60">
          Players or teams take turns in a <strong className="text-black/80">fixed rotation</strong> established
          at the start of the game. The order does not change during play.
        </p>
      </section>

      {/* Distance rule */}
      <section className="rounded-xl border border-black/10 bg-white p-6 space-y-2">
        <h2 className="text-2xl font-bold text-emerald-800">Distance Rule</h2>
        <p className="text-sm text-black/60">
          If a skittle lands <strong className="text-black/80">3 or more metres</strong> from the throwing line
          after being knocked over, it is <strong className="text-black/80">removed from the game</strong> permanently.
        </p>
      </section>
    </div>
  );
}
