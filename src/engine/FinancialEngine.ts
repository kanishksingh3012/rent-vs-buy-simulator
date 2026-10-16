/**
 * FinancialEngine — pure Rent vs. Buy projection core (no React).
 *
 * Every intermediate value is a decimal.js Decimal (40 significant digits);
 * values are rounded to 2 dp only when emitted.
 *
 * Model (monthly loop, m = 1 … horizon×12):
 *  Buyer
 *   - Fixed EMI amortization; 0% interest falls back to straight-line L/n.
 *   - Property value compounds monthly at (1+g)^(1/12) so year-ends match g exactly.
 *   - Maintenance/taxes = maintenancePct × property value at the start of each year, paid monthly.
 *   - Tax shield_m = interest_m × marginal rate (sums to annual interest × rate).
 *   - NW_buy = V − B − sellingCost (liquid toggle off: NW_buy = −B, no sale).
 *  Renter
 *   - P0 = down payment + closing costs.
 *   - S_m = (payment + maintenance − tax shield) − rent.
 *   - P_m = P_{m−1}·(1 + r/12) + S_m.
 *   - NW_rent = P − max(0, P − basis)·cgRate − debt.
 *   - Negative S_m is funded by selling units: realized gains are taxed at sale and the
 *     basis is reduced pro-rata (average cost). With only non-negative flows this reduces
 *     exactly to the PRD formula basis = P0 + ΣS_m.
 *   - Once the portfolio is exhausted the remaining shortfall is either reported
 *     (`floor`, default) or accrues as debt at `debtInterestRate` (`debt`).
 */
import Decimal from 'decimal.js'
import type {
  BreakEven,
  Crossing,
  SimulationInputs,
  SimulationOutput,
  SimulationResult,
} from './types'

const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })
type D = InstanceType<typeof Dec>

const ZERO = new Dec(0)
const ONE = new Dec(1)
const MAX_HORIZON_YEARS = 50

const pct = (v: number): D => new Dec(v).div(100)
const max0 = (d: D): D => (d.isNegative() ? ZERO : d)
/** Round to cents (half-up, display convention); `+ 0` normalizes -0. */
const out = (d: D): number => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() + 0

export class SimulationInputError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Invalid simulation inputs: ${issues.join('; ')}`)
    this.name = 'SimulationInputError'
    this.issues = issues
  }
}

export function validateInputs(inputs: SimulationInputs): string[] {
  const { property: p, rent: r, market: mk, taxes: t, settings: s } = inputs
  const issues: string[] = []
  const check = (ok: boolean, msg: string) => {
    if (!ok) issues.push(msg)
  }
  const num = (v: number) => typeof v === 'number' && Number.isFinite(v)
  const inRange = (v: number, lo: number, hi: number) => num(v) && v >= lo && v <= hi

  check(num(p.price) && p.price > 0, 'property.price must be > 0')
  check(inRange(p.downPaymentPct, 0, 100), 'property.downPaymentPct must be within [0, 100]')
  check(num(p.interestRate) && p.interestRate >= 0, 'property.interestRate must be >= 0')
  check(num(p.closingCostsPct) && p.closingCostsPct >= 0, 'property.closingCostsPct must be >= 0')
  check(num(p.appreciationRate) && p.appreciationRate > -100, 'property.appreciationRate must be > -100')
  check(num(p.maintenancePct) && p.maintenancePct >= 0, 'property.maintenancePct must be >= 0')
  const hasLoan = num(p.downPaymentPct) && p.downPaymentPct < 100
  check(
    !hasLoan || (Number.isInteger(p.loanTenureYears) && p.loanTenureYears >= 1 && p.loanTenureYears <= MAX_HORIZON_YEARS),
    `property.loanTenureYears must be an integer within [1, ${MAX_HORIZON_YEARS}] when a loan is taken`,
  )
  check(num(r.monthlyRent) && r.monthlyRent >= 0, 'rent.monthlyRent must be >= 0')
  check(num(r.annualEscalationRate) && r.annualEscalationRate > -100, 'rent.annualEscalationRate must be > -100')
  check(num(mk.investmentReturnRate) && mk.investmentReturnRate > -100, 'market.investmentReturnRate must be > -100')
  check(num(mk.sellingCostPct) && mk.sellingCostPct >= 0 && mk.sellingCostPct < 100, 'market.sellingCostPct must be within [0, 100)')
  check(inRange(t.marginalTaxRate, 0, 100), 'taxes.marginalTaxRate must be within [0, 100]')
  check(inRange(t.capitalGainsRate, 0, 100), 'taxes.capitalGainsRate must be within [0, 100]')
  check(
    Number.isInteger(s.timeHorizonYears) && s.timeHorizonYears >= 1 && s.timeHorizonYears <= MAX_HORIZON_YEARS,
    `settings.timeHorizonYears must be an integer within [1, ${MAX_HORIZON_YEARS}]`,
  )
  check(s.debtInterestRate === undefined || (num(s.debtInterestRate) && s.debtInterestRate >= 0), 'settings.debtInterestRate must be >= 0')
  return issues
}

function emiDecimal(principal: D, monthlyRate: D, months: number): D {
  if (principal.lte(0) || months <= 0) return ZERO
  if (monthlyRate.isZero()) return principal.div(months)
  return principal.mul(monthlyRate).div(ONE.minus(ONE.plus(monthlyRate).pow(-months)))
}

/** Locate every intersection of the two wealth lines (diff = buy − rent). */
function findCrossings(diffs: D[]): Crossing[] {
  const crossings: Crossing[] = []
  let lastIdx = -1
  let lastSign = 0
  diffs.forEach((d, m) => {
    const sign = d.isZero() ? 0 : d.isPositive() ? 1 : -1
    if (sign === 0) return
    if (lastSign !== 0 && sign !== lastSign) {
      const prev = diffs[lastIdx]
      // Adjacent months: linear interpolation. Otherwise the tie happened at lastIdx + 1.
      const exact = m - lastIdx === 1 ? new Dec(lastIdx).plus(prev.div(prev.minus(d))) : new Dec(lastIdx + 1)
      crossings.push({
        exactMonth: exact.toDecimalPlaces(4).toNumber(),
        month: m,
        direction: sign > 0 ? 'buy-overtakes' : 'rent-overtakes',
      })
    }
    lastIdx = m
    lastSign = sign
  })
  return crossings
}

export class FinancialEngine {
  /** Fixed monthly installment. `annualRatePct` is a percentage (6.5 = 6.5%). */
  static calculateEmi(principal: number, annualRatePct: number, months: number): number {
    return out(emiDecimal(new Dec(principal), pct(annualRatePct).div(12), months))
  }

  static simulate(inputs: SimulationInputs): SimulationOutput {
    const issues = validateInputs(inputs)
    if (issues.length) throw new SimulationInputError(issues)

    const { property: p, rent: r, market: mk, taxes: t, settings: s } = inputs
    const includeSale = s.includeHomeSaleInWealth
    const debtMode = (s.negativePortfolioMode ?? 'floor') === 'debt'

    // --- Constants ---
    const V0 = new Dec(p.price)
    const downPayment = V0.mul(pct(p.downPaymentPct))
    const loanAmount = V0.minus(downPayment)
    const transactionCosts = V0.mul(pct(p.closingCostsPct))
    const loanMonths = loanAmount.gt(0) ? p.loanTenureYears * 12 : 0
    const loanRate = pct(p.interestRate).div(12)
    const emi = emiDecimal(loanAmount, loanRate, loanMonths)
    const annualPropertyGrowth = ONE.plus(pct(p.appreciationRate))
    const propertyGrowth = annualPropertyGrowth.pow(ONE.div(12))
    const rentGrowth = ONE.plus(pct(r.annualEscalationRate))
    const invGrowth = ONE.plus(pct(mk.investmentReturnRate).div(12))
    const debtGrowth = ONE.plus(pct(s.debtInterestRate ?? 0).div(12))
    const maintenanceRate = pct(p.maintenancePct)
    const sellingRate = pct(mk.sellingCostPct)
    const marginalRate = pct(t.marginalTaxRate)
    const cgRate = pct(t.capitalGainsRate)
    const totalMonths = s.timeHorizonYears * 12

    // --- Running state ---
    let V = V0
    let B = loanAmount
    let P = downPayment.plus(transactionCosts)
    let basis = P
    let debt = ZERO
    let rent = new Dec(r.monthlyRent)
    let annualMaintenance = ZERO
    let yearStartValue = V0

    const totals = {
      loanPayments: ZERO,
      interestPaid: ZERO,
      taxShield: ZERO,
      maintenance: ZERO,
      rentPaid: ZERO,
      cgTaxPaid: ZERO,
      unfunded: ZERO,
    }

    /** Fund a withdrawal of `need` from the portfolio, realizing (and taxing) gains pro-rata. */
    const withdraw = (need: D): D => {
      if (P.lte(0)) return need
      const gainFraction = P.gt(basis) ? P.minus(basis).div(P) : ZERO
      const netPerUnit = ONE.minus(gainFraction.mul(cgRate))
      if (netPerUnit.gt(0)) {
        const gross = need.div(netPerUnit)
        if (gross.lte(P)) {
          totals.cgTaxPaid = totals.cgTaxPaid.plus(gross.mul(gainFraction).mul(cgRate))
          basis = basis.minus(basis.mul(gross).div(P))
          P = P.minus(gross)
          return ZERO
        }
      }
      // Liquidate everything; whatever is still missing is returned.
      const tax = max0(P.minus(basis)).mul(cgRate)
      totals.cgTaxPaid = totals.cgTaxPaid.plus(tax)
      const remaining = need.minus(P.minus(tax))
      P = ZERO
      basis = ZERO
      return max0(remaining)
    }

    const diffs: D[] = []

    const snapshot = (
      month: number,
      flows: { payment: D; interest: D; principal: D; maintenance: D; shield: D; rent: D },
    ): SimulationResult => {
      const sellingCost = includeSale ? V.mul(sellingRate) : ZERO
      const buyerNW = includeSale ? V.minus(B).minus(sellingCost) : B.neg()
      const cgLiability = max0(P.minus(basis)).mul(cgRate)
      const renterNW = P.minus(cgLiability).minus(debt)
      const diff = buyerNW.minus(renterNW)
      diffs.push(diff)
      const buyerOutflow = flows.payment.plus(flows.maintenance).minus(flows.shield)
      return {
        month,
        year: Math.ceil(month / 12),
        propertyValue: out(V),
        loanBalance: out(B),
        loanPayment: out(flows.payment),
        interestPaid: out(flows.interest),
        principalPaid: out(flows.principal),
        maintenance: out(flows.maintenance),
        taxShield: out(flows.shield),
        buyerOutflow: out(buyerOutflow),
        sellingCost: out(sellingCost),
        buyerNetWealth: out(buyerNW),
        rent: out(flows.rent),
        monthlySavings: out(buyerOutflow.minus(flows.rent)),
        portfolioValue: out(P),
        costBasis: out(basis),
        capitalGainsTaxLiability: out(cgLiability),
        renterDebt: out(debt),
        renterNetWealth: out(renterNW),
        netWealthDifference: out(diff),
      }
    }

    const initial = snapshot(0, {
      payment: ZERO,
      interest: ZERO,
      principal: ZERO,
      maintenance: ZERO,
      shield: ZERO,
      rent: ZERO,
    })
    const series: SimulationResult[] = []

    for (let m = 1; m <= totalMonths; m++) {
      if ((m - 1) % 12 === 0) {
        yearStartValue = V
        annualMaintenance = V.mul(maintenanceRate)
        if (m > 1) rent = rent.mul(rentGrowth)
      }

      // Amortization (EMI = 0 after the tenure: post-mortgage era).
      let interest = ZERO
      let principal = ZERO
      if (m <= loanMonths && B.gt(0)) {
        interest = B.mul(loanRate)
        principal = m === loanMonths ? B : Dec.min(emi.minus(interest), B)
        B = B.minus(principal)
      }
      const payment = interest.plus(principal)
      const maintenance = annualMaintenance.div(12)
      const shield = interest.mul(marginalRate)
      const savings = payment.plus(maintenance).minus(shield).minus(rent)

      // Growth for the month, then end-of-month cash flows.
      // Year-ends anchor to start × (1+g) so the 12th-root drift never accumulates.
      V = m % 12 === 0 ? yearStartValue.mul(annualPropertyGrowth) : V.mul(propertyGrowth)
      P = P.mul(invGrowth)
      debt = debt.mul(debtGrowth)

      if (savings.gte(0)) {
        const repay = Dec.min(savings, debt)
        debt = debt.minus(repay)
        P = P.plus(savings.minus(repay))
        basis = basis.plus(savings.minus(repay))
      } else {
        const missing = withdraw(savings.neg())
        if (missing.gt(0)) {
          if (debtMode) debt = debt.plus(missing)
          else totals.unfunded = totals.unfunded.plus(missing)
        }
      }

      totals.loanPayments = totals.loanPayments.plus(payment)
      totals.interestPaid = totals.interestPaid.plus(interest)
      totals.taxShield = totals.taxShield.plus(shield)
      totals.maintenance = totals.maintenance.plus(maintenance)
      totals.rentPaid = totals.rentPaid.plus(rent)

      series.push(snapshot(m, { payment, interest, principal, maintenance, shield, rent }))
    }

    const last = series[series.length - 1]
    const crossings = findCrossings(diffs)
    const firstBuyWin = crossings.find((c) => c.direction === 'buy-overtakes')
    const breakEven: BreakEven | null = firstBuyWin
      ? {
          month: firstBuyWin.month,
          exactMonth: firstBuyWin.exactMonth,
          years: new Dec(firstBuyWin.exactMonth).div(12).toDecimalPlaces(4).toNumber(),
        }
      : null
    const finalSellingCost = includeSale ? V.mul(sellingRate) : ZERO

    return {
      initial,
      series,
      summary: {
        monthlyEmi: out(emi),
        loanAmount: out(loanAmount),
        upfrontCash: out(downPayment.plus(transactionCosts)),
        finalBuyerNetWealth: last.buyerNetWealth,
        finalRenterNetWealth: last.renterNetWealth,
        finalDifference: last.netWealthDifference,
        winner: last.netWealthDifference > 0 ? 'buy' : last.netWealthDifference < 0 ? 'rent' : 'tie',
        breakEven,
        crossings,
        totals: {
          loanPayments: out(totals.loanPayments),
          interestPaid: out(totals.interestPaid),
          taxShield: out(totals.taxShield),
          maintenance: out(totals.maintenance),
          rentPaid: out(totals.rentPaid),
          transactionCosts: out(transactionCosts),
          finalSellingCost: out(finalSellingCost),
          buyerUnrecoverableCosts: out(
            totals.interestPaid.plus(totals.maintenance).plus(transactionCosts).plus(finalSellingCost).minus(totals.taxShield),
          ),
          capitalGainsTaxPaidOnWithdrawals: out(totals.cgTaxPaid),
          unfundedShortfall: out(totals.unfunded),
        },
      },
    }
  }
}

export const simulate = (inputs: SimulationInputs): SimulationOutput => FinancialEngine.simulate(inputs)
