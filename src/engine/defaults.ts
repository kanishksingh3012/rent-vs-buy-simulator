import type { SimulationInputs } from './types'

/** Baseline scenario used by the store and as the test fixture. Percent units throughout. */
export const DEFAULT_INPUTS: SimulationInputs = {
  property: {
    price: 500_000,
    downPaymentPct: 20,
    interestRate: 6.5,
    loanTenureYears: 30,
    closingCostsPct: 3,
    appreciationRate: 3.5,
    maintenancePct: 1.5,
  },
  rent: { monthlyRent: 2_000, annualEscalationRate: 3 },
  market: { investmentReturnRate: 7, sellingCostPct: 6 },
  taxes: { marginalTaxRate: 24, capitalGainsRate: 15 },
  settings: {
    timeHorizonYears: 30,
    includeHomeSaleInWealth: true,
    negativePortfolioMode: 'floor',
    debtInterestRate: 12,
  },
}
