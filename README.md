# Rent vs. Buy Financial Simulator

Client-side simulator comparing the long-term net wealth of **buying a home** versus **renting and investing the difference**.

- **Engine:** pure TypeScript + [`decimal.js`](https://github.com/MikeMcl/decimal.js) (no floating-point drift)
- **State:** Zustand
- **Build/Test:** Vite + Vitest
- **UI:** [HeroUI](https://heroui.com) (v3) + Tailwind CSS v4 + Recharts

100% client-side — **no accounts, no backend, nothing stored or sent anywhere.**

## Getting started
```bash
npm install
npm test          # engine + store test suites
npm run typecheck
npm run dev
```

## Usage
```ts
import { simulate, DEFAULT_INPUTS } from './src/engine'

const { series, summary } = simulate(DEFAULT_INPUTS)
summary.breakEven        // { month, exactMonth, years } | null
summary.finalBuyerNetWealth, summary.finalRenterNetWealth
```

## Edge cases covered
0% interest · 100% down payment · underwater mortgages (negative equity, not floored) · post-mortgage era · negative monthly savings drain (floor or high-interest debt) · tax shield on mortgage interest · capital-gains tax only on positive gains · "Forever Home" illiquid-wealth toggle · input validation.

See [`docs/PRD.md`](docs/PRD.md) and [`docs/TRD.md`](docs/TRD.md) for the full specification, and [`CLAUDE.md`](CLAUDE.md) for modeling decisions.
