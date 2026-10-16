/**
 * Shared types for the Rent vs. Buy engine.
 *
 * UNIT CONVENTION: every `*Pct` / `*Rate` field is a PERCENTAGE value
 * (e.g. `6.5` means 6.5%), mirroring what the UI sliders show. The engine
 * converts to fractions internally.
 */

export interface PropertyInputs {
  price: number
  downPaymentPct: number
  interestRate: number
  loanTenureYears: number
  closingCostsPct: number
  appreciationRate: number
  /** Annual maintenance + property tax, as % of the property value at the start of each year. */
  maintenancePct: number
}

export interface RentInputs {
  monthlyRent: number
  annualEscalationRate: number
}

export interface MarketInputs {
  investmentReturnRate: number
  sellingCostPct: number
}

export interface TaxInputs {
  marginalTaxRate: number
  capitalGainsRate: number
}

/**
 * How the renter's portfolio behaves when monthly savings are negative and the
 * portfolio is exhausted (PRD §4 "Negative Savings Drain").
 * - `floor`: portfolio is capped at 0; the uncovered amount is reported as `unfundedShortfall`.
 * - `debt`:  the uncovered amount becomes debt accruing `debtInterestRate` (APR, %).
 */
export type NegativePortfolioMode = 'floor' | 'debt'

export interface SettingsInputs {
  timeHorizonYears: number
  /** `false` = "Forever Home": property excluded from buyer wealth, no sale costs. */
  includeHomeSaleInWealth: boolean
  negativePortfolioMode?: NegativePortfolioMode
  debtInterestRate?: number
}

export interface SimulationInputs {
  property: PropertyInputs
  rent: RentInputs
  market: MarketInputs
  taxes: TaxInputs
  settings: SettingsInputs
}

/** One row per simulated month. Monetary values are rounded to 2 dp. */
export interface SimulationResult {
  month: number
  year: number
  // Buyer
  propertyValue: number
  loanBalance: number
  loanPayment: number
  interestPaid: number
  principalPaid: number
  maintenance: number
  taxShield: number
  buyerOutflow: number
  sellingCost: number
  buyerNetWealth: number
  // Renter
  rent: number
  monthlySavings: number
  portfolioValue: number
  costBasis: number
  capitalGainsTaxLiability: number
  renterDebt: number
  renterNetWealth: number
  // Comparison
  netWealthDifference: number
}

export interface Crossing {
  /** Interpolated (fractional) month at which the lines intersect. */
  exactMonth: number
  /** First whole month at which the new leader is observed. */
  month: number
  direction: 'buy-overtakes' | 'rent-overtakes'
}

export interface BreakEven {
  month: number
  exactMonth: number
  years: number
}

export interface SimulationSummary {
  monthlyEmi: number
  loanAmount: number
  upfrontCash: number
  finalBuyerNetWealth: number
  finalRenterNetWealth: number
  finalDifference: number
  winner: 'buy' | 'rent' | 'tie'
  /** First month the buyer overtakes the renter; `null` if it never happens. */
  breakEven: BreakEven | null
  crossings: Crossing[]
  totals: {
    loanPayments: number
    interestPaid: number
    taxShield: number
    maintenance: number
    rentPaid: number
    transactionCosts: number
    finalSellingCost: number
    /** interest + maintenance + transaction + selling − tax shield */
    buyerUnrecoverableCosts: number
    capitalGainsTaxPaidOnWithdrawals: number
    unfundedShortfall: number
  }
}

export interface SimulationOutput {
  initial: SimulationResult
  series: SimulationResult[]
  summary: SimulationSummary
}
