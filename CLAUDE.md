# Rent vs. Buy Simulator — agent notes

Specs: `docs/PRD.md` (math + edge cases), `docs/TRD.md` (stack, store, NFRs). Read those for intent; this file records decisions.

## Status
- Phase 1 DONE: `src/engine/` (pure, decimal.js) + `tests/engine.test.ts`.
- Phase 2 DONE: `src/store/useSimulatorStore.ts` (Zustand) + `tests/store.test.ts`.
- Phase 3 (UI) PENDING — user will specify the UI component library. Don't add Tailwind/shadcn/Recharts until then. `src/App.tsx` is still the Vite template.

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
