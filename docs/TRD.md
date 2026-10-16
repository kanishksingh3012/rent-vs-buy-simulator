# Technical Requirements Document (TRD)

## Project: Rent vs. Buy Financial Simulator

### 1. System Architecture Overview
The application will be a purely client-side Single Page Application (SPA). Given the highly interactive nature of the simulator (sliders instantly updating charts), server-side rendering or backend calculation would introduce unnecessary latency. All state management and mathematical projections will happen directly in the browser.

### 2. Technology Stack (100% Open Source)
* **Core Framework:** React 18+ via Vite (Lightning-fast HMR and optimized build).
* **Language:** TypeScript (Strict mode enabled to ensure mathematical type safety).
* **State Management:** Zustand (Minimalist, boilerplate-free state, perfect for flat financial parameter objects).
* **Financial Math:** `decimal.js` (CRITICAL: Native JavaScript floating-point math like `0.1 + 0.2` will break financial projections. We must use arbitrary-precision decimal libraries).
* **Charting:** Recharts (React-native, declarative D3 wrapper, handles large time-series arrays efficiently).
* **Styling:** Tailwind CSS (Utility-first, fast styling).
* **UI Components:** Radix UI primitives + shadcn/ui (Accessible, unstyled components styled with Tailwind).
* **Testing:** Vitest + React Testing Library (Vitest is native to Vite and extremely fast for testing pure math functions).

### 3. Application State Design (Zustand Store)
The global store will be divided into inputs and derived outputs.

```typescript
interface SimulatorState {
  // --- INPUTS ---
  property: {
    price: number;
    downPaymentPct: number;
    interestRate: number;
    loanTenureYears: number;
    closingCostsPct: number;
    appreciationRate: number;
    maintenancePct: number;
  };
  rent: {
    monthlyRent: number;
    annualEscalationRate: number;
  };
  market: {
    investmentReturnRate: number;
    sellingCostPct: number;
  };
  taxes: {
    marginalTaxRate: number;
    capitalGainsRate: number;
  };
  settings: {
    timeHorizonYears: number;
    includeHomeSaleInWealth: boolean; // Handles the "Forever Home" edge case
  };

  // --- ACTIONS ---
  updateProperty: (key: keyof SimulatorState['property'], value: number) => void;
  updateRent: (key: keyof SimulatorState['rent'], value: number) => void;
  updateTaxes: (key: keyof SimulatorState['taxes'], value: number) => void;
  // ...other updaters
}
```

### 4. Core Modules & Directory Structure
* `/src/engine/FinancialEngine.ts`: The pure logic core. Takes the `SimulatorState` inputs and returns `SimulationResult[]`. Contains ZERO React code.
* `/src/store/useSimulatorStore.ts`: The Zustand state implementation.
* `/src/components/ui/`: Reusable shadcn/ui components (Sliders, Inputs, Cards).
* `/src/components/simulator/`:
  * `ControlPanel.tsx`: Houses all sliders and numerical inputs.
  * `WealthChart.tsx`: The Recharts implementation rendering the dual timelines.
  * `SummaryMetrics.tsx`: Displays break-even year, final net wealth, and total costs.
* `/tests/engine.test.ts`: Vitest suite specifically hammering the edge cases (Negative savings, 0% interest, post-mortgage calculations, tax logic).

### 5. Mathematical Precision Requirements
* All intermediate calculations (e.g., monthly compound interest, amortization fractions) must be calculated to at least 6 decimal places using `decimal.js`.
* Final output values for the UI array can be rounded to the nearest integer.
* *Time Complexity:* The calculation runs an $O(N)$ loop where $N$ is months (max $40 \times 12 = 480$). Memoization (`useMemo`) is required at the top level of the chart component to prevent re-renders when non-simulation UI state changes.

### 6. Non-Functional Requirements (NFRs)
* **Performance:** The chart must update at $\ge 60$ FPS when a user drags a slider. Debouncing the `FinancialEngine` calculation by $50\text{ms}$ during slider drag events is recommended if UI lag is detected.
* **Responsiveness:** The layout will be a CSS Grid. Desktop: Two-column layout (Controls Left | Charts Right). Mobile: Stacked layout (Charts sticky at the top | Controls scrollable below).

### 7. Implementation Prompting Guide for Claude
1. **Initialize:** `npx create-vite rent-vs-buy --template react-ts`
2. **Dependencies:** `npm install zustand decimal.js recharts tailwindcss lucide-react`
3. **Step 1:** Instruct Claude to write `FinancialEngine.ts` and `engine.test.ts` FIRST.
4. **Step 2:** Instruct Claude to setup the Zustand store.
5. **Step 3:** Instruct Claude to build the Control Panel inputs.
6. **Step 4:** Instruct Claude to wire the engine output to Recharts.