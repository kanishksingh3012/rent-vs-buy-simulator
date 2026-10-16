# Rent vs. Buy Simulator — agent notes

Specs: `docs/PRD.md` (math + edge cases), `docs/TRD.md` (stack, store, NFRs). Read those for intent; this file records decisions.

## Status
- Phase 1 DONE: `src/engine/` (pure, decimal.js) + `tests/engine.test.ts`.
- Phase 2 DONE: `src/store/useSimulatorStore.ts` (Zustand) + `tests/store.test.ts`.
- Phase 3 DONE: UI built with HeroUI v3 (react-aria-components primitives) + Tailwind v4 + Recharts.
  `src/components/simulator/` (ControlPanel, ParamField, SummaryMetrics, WealthChart), `src/App.tsx`.
  No shadcn/Radix — the TRD's original UI stack was superseded by the user's HeroUI choice.
  Standalone, no accounts/backend — confirmed by user.

## HeroUI v3 gotchas (hit while building Phase 3)
- Everything is compositional (`Slider.Root/Track/Fill/Thumb`, `NumberField.Root/Group/Input`, no single `<Slider>` prop-driven component). Check `node_modules/@heroui/react/dist/components/<name>/<name>.d.ts` when unsure of a part's props.
- `Card.Content` has `flex: 1` baked in — don't put a fixed height (e.g. `h-80`) directly on it for a Recharts `ResponsiveContainer`; wrap the chart in an inner `<div className="h-80">` instead, or the computed height collapses to content size.
- Recharts `<Line>` defaults to an entrance animation (`stroke-dasharray` 0→full) — screenshots/automation taken right after navigation can catch it mid-animation (invisible). Set `isAnimationActive={false}` on `Line`.
- Theming is `.dark` class / `[data-theme="dark"]` attribute, **not** `prefers-color-scheme` media query. We sync it ourselves via an inline script in `index.html` (`matchMedia('(prefers-color-scheme: dark)')` + a change listener) to avoid a flash and support system dark mode without a manual toggle.
- Tailwind color tokens come from `@heroui/styles`: `bg-background`, `text-foreground`, `text-muted` (not `muted-foreground`), `bg-surface`/`text-surface-foreground`, `border-border`, plus `accent/danger/success/warning` (+ `-soft`, `-foreground` variants).

## Commands
`npm test` · `npm run typecheck` · `npm run lint` · `npm run dev`

## Engine conventions / modeling decisions
- All `*Pct` / `*Rate` inputs are percentages (6.5 = 6.5%).
- Engine never uses JS float math; outputs rounded to cents (half-up) only at emit.
- Series = months 1..horizon×12; `initial` = month-0 snapshot (used for break-even).
- Property: monthly (1+g)^(1/12), year-ends anchored to start×(1+g).
- Maintenance = maintenancePct × value at start of each year (grows with appreciation).
- Rent escalates at year boundaries. Tax shield = monthly interest × marginal rate.
- Negative savings: withdrawals realize gains (taxed at sale, pro-rata basis). Portfolio exhausted → `floor` (report `unfundedShortfall`, default) or `debt` (accrues `debtInterestRate`).
- `includeHomeSaleInWealth=false` → NW_buy = −loanBalance (no property, no sale cost).
- Break-even = first "buy-overtakes" crossing, linearly interpolated.
