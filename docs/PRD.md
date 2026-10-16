# Product Scope: Rent vs. Buy Financial Simulator

## 1. Project Overview
A highly accurate, interactive web-based financial simulator comparing the long-term net wealth of buying a home versus renting and investing the difference. The engine projects two parallel timelines over a user-defined horizon (e.g., 30 years) and calculates the Net Wealth of each at year $t$.

## 2. Data Architecture (State Management)
The application state must handle the following core inputs:

### Property & Loan Variables
* **Property Price ($V_0$)**
* **Down Payment ($D$):** Percentage of $V_0$.
* **Loan Interest Rate ($R_{loan}$):** Annual percentage rate.
* **Loan Tenure ($N$):** Total years of the mortgage.
* **Transaction Costs ($C_{txn}$):** Upfront cash costs (e.g., closing costs, stamp duty) as a % of $V_0$.
* **Property Appreciation ($g_{prop}$):** Annual growth rate.

### Renting Variables
* **Monthly Rent ($Rent_0$)**
* **Annual Rent Escalation ($e_{rent}$):** Annual % increase.

### Market, Maintenance & Tax Variables
* **Investment Return ($r_{inv}$):** Expected annualized return of the market portfolio.
* **Maintenance & Taxes ($M_0$):** Annual property costs as a % of $V_0$.
* **Selling Costs:** Frictional cost to sell the house (e.g., 6% broker fee).
* **Marginal Tax Rate:** Used to calculate mortgage interest tax deductions for the buyer.
* **Capital Gains Tax Rate:** Applied to the renter's liquid portfolio gains upon realization.

## 3. The Mathematical Engine (Core Loop)
The logic must be isolated in a pure utility class (e.g., `FinancialEngine.ts`) that returns a time-series array (Months 1 to $N \times 12$).

### Scenario A: Homebuyer Net Wealth
1. **Amortization:** Calculate fixed EMI. *Crucial:* Handle 0% interest rate division-by-zero errors gracefully.
2. **Tax Shield:** Calculate annual interest paid. $Savings_{tax, y} = InterestPaid_{y} \times Rate_{marginal}$. Subtract this from the buyer's total unrecoverable costs.
3. **Property Value ($V_t$):** Compound annually/monthly based on $g_{prop}$.
4. **Outstanding Balance ($B_t$):** Track remaining principal.
5. **Formula:** $NW_{buy, t} = V_t - B_t - C_{sell}$

### Scenario B: Renter Net Wealth
1. **Initial Corpus ($P_0$):** Cash saved upfront ($V_0 \times D + C_{txn}$).
2. **Monthly Cash Flow Difference ($S_m$):** $(EMI + Maintenance_m + PropertyTax_m - TaxShield_m) - Rent_m$.
3. **Portfolio Value ($P_t$):** Compound monthly. $P_t = P_{t-1} \times (1 + r_{inv}/12) + S_m$.
4. **Capital Gains Tax ($Tax_{cg}$):** Calculate total principle contributions ($C_t = P_0 + \sum S_m$). Calculate gains ($G_t = P_t - C_t$). $Tax_{cg} = G_t \times Rate_{cg}$.
5. **Formula:** $NW_{rent, t} = P_t - Tax_{cg}$

## 4. Critical Edge Cases to Handle (Acceptance Criteria)
* **Negative Savings Drain ($S_m < 0$):** If rent > buying costs, deduct the shortfall from the renter's portfolio. If the portfolio drops to 0, cap at 0 or track as high-interest debt.
* **Post-Mortgage Era:** After loan tenure ends (e.g., year 31 of a 40-year horizon), EMI drops to 0. Only maintenance and taxes remain.
* **Underwater Mortgages:** Allow $NW_{buy, t}$ to go negative if property value drops below the loan balance. Do not floor at zero.
* **Illiquid vs. Liquid Wealth Toggle:** Provide a UI option to calculate buyer wealth *without* selling the home (zeroing out the property value in the comparison, treating it purely as a living utility).

## 5. Required UI Outputs
* **Time-Series Chart:** Visualizing $NW_{buy}$ vs. $NW_{rent}$ over time.
* **Break-Even Indicator:** Calculate the exact month/year the two lines intersect.
* **Summary Cards:** Final Buyer Net Wealth vs. Final Renter Net Wealth.

## 6. Implementation Strategy for Claude Code
1. **Phase 1:** Build the pure mathematical engine (`FinancialEngine`) using `decimal.js` with robust unit tests covering the edge cases.
2. **Phase 2:** Build the UI state management to collect inputs via Zustand.
3. **Phase 3:** Integrate the engine with Recharts to visualize the output array.