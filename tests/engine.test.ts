import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INPUTS,
  FinancialEngine,
  SimulationInputError,
  simulate,
  type SimulationInputs,
  type SimulationResult,
} from '../src/engine'

type Overrides = { [K in keyof SimulationInputs]?: Partial<SimulationInputs[K]> }

const make = (o: Overrides = {}): SimulationInputs => ({
  property: { ...DEFAULT_INPUTS.property, ...o.property },
  rent: { ...DEFAULT_INPUTS.rent, ...o.rent },
  market: { ...DEFAULT_INPUTS.market, ...o.market },
  taxes: { ...DEFAULT_INPUTS.taxes, ...o.taxes },
  settings: { ...DEFAULT_INPUTS.settings, ...o.settings },
})

const at = (series: SimulationResult[], month: number) => series[month - 1]
const sum = (rows: SimulationResult[], key: keyof SimulationResult) =>
  rows.reduce((acc, r) => acc + (r[key] as number), 0)
// Each emitted field is rounded to cents, so identities between fields hold within ~1.5 cents.
const CENTS = 0.015

/** Independent float implementation of the PRD formulas (valid only when S_m >= 0 every month). */
function referenceModel(inp: SimulationInputs) {
  const { property: p, rent: r, market: mk, taxes: t, settings: s } = inp
  const L = p.price * (1 - p.downPaymentPct / 100)
  const i = p.interestRate / 100 / 12
  const n = p.loanTenureYears * 12
  const emi = i === 0 ? L / n : (L * i) / (1 - Math.pow(1 + i, -n))
  let V = p.price
  let B = L
  let P = p.price * (p.downPaymentPct / 100) + p.price * (p.closingCostsPct / 100)
  const P0 = P
  let sumS = 0
  let rent = r.monthlyRent
  let maint = 0
  const rows: { buy: number; rent: number }[] = []
  for (let m = 1; m <= s.timeHorizonYears * 12; m++) {
    if ((m - 1) % 12 === 0) {
      maint = V * (p.maintenancePct / 100)
      if (m > 1) rent *= 1 + r.annualEscalationRate / 100
    }
    let interest = 0
    let payment = 0
    if (m <= n) {
      interest = B * i
      payment = m === n ? B + interest : emi
      B -= payment - interest
    }
    const S = payment + maint / 12 - interest * (t.marginalTaxRate / 100) - rent
    V *= Math.pow(1 + p.appreciationRate / 100, 1 / 12)
    P = P * (1 + mk.investmentReturnRate / 100 / 12) + S
    sumS += S
    const C = P0 + sumS
    const G = P - C
    rows.push({
      buy: V - B - V * (mk.sellingCostPct / 100),
      rent: P - Math.max(0, G) * (t.capitalGainsRate / 100),
    })
  }
  return rows
}

describe('EMI / amortization', () => {
  it('matches the textbook EMI (100k @ 6% over 30y = 599.55)', () => {
    expect(FinancialEngine.calculateEmi(100_000, 6, 360)).toBe(599.55)
  })

  it('handles 0% interest without division by zero (straight-line principal)', () => {
    expect(FinancialEngine.calculateEmi(120_000, 0, 120)).toBe(1000)
    const { series, summary } = simulate(make({ property: { interestRate: 0 } }))
    expect(summary.monthlyEmi).toBe(1111.11) // 400,000 / 360
    expect(summary.totals.interestPaid).toBe(0)
    expect(summary.totals.taxShield).toBe(0)
    expect(at(series, 180).loanBalance).toBe(200_000)
    expect(at(series, 360).loanBalance).toBe(0)
    for (const row of series) for (const v of Object.values(row)) expect(Number.isFinite(v)).toBe(true)
  })

  it('stays finite and ≈ straight-line for a near-zero rate', () => {
    const emi = FinancialEngine.calculateEmi(120_000, 0.0001, 120)
    expect(Number.isFinite(emi)).toBe(true)
    expect(emi).toBeCloseTo(1000, 0)
  })

  it('fully amortizes: balance hits exactly 0 and principal sums to the loan', () => {
    const { series, summary } = simulate(make())
    expect(at(series, 360).loanBalance).toBe(0)
    expect(sum(series, 'principalPaid')).toBeCloseTo(400_000, 0)
    expect(summary.totals.loanPayments - summary.totals.interestPaid).toBeCloseTo(400_000, 1)
    // Balance never increases and never goes negative.
    series.reduce((prev, r) => {
      expect(r.loanBalance).toBeLessThanOrEqual(prev)
      expect(r.loanBalance).toBeGreaterThanOrEqual(0)
      return r.loanBalance
    }, Infinity)
  })

  it('handles 100% down payment (no loan)', () => {
    const { series, summary, initial } = simulate(make({ property: { downPaymentPct: 100, loanTenureYears: 0 } }))
    expect(summary.loanAmount).toBe(0)
    expect(summary.monthlyEmi).toBe(0)
    expect(series.every((r) => r.loanPayment === 0 && r.loanBalance === 0 && r.taxShield === 0)).toBe(true)
    expect(initial.buyerNetWealth).toBe(500_000 - 30_000)
  })
})

describe('Tax shield', () => {
  it('month-1 shield = interest × marginal rate', () => {
    const { series } = simulate(make())
    expect(at(series, 1).interestPaid).toBe(2166.67) // 400,000 × 6.5% / 12
    expect(at(series, 1).taxShield).toBe(520) // × 24%
  })

  it('annual shield = annual interest paid × marginal rate', () => {
    const { series } = simulate(make())
    const year1 = series.slice(0, 12)
    expect(sum(year1, 'taxShield')).toBeCloseTo(sum(year1, 'interestPaid') * 0.24, 1)
  })

  it('reduces buyer outflow (and so renter savings) by exactly the shield amount', () => {
    const withShield = simulate(make()).series
    const without = simulate(make({ taxes: { marginalTaxRate: 0 } })).series
    for (const m of [1, 60, 240]) {
      const a = at(withShield, m)
      const b = at(without, m)
      expect(b.taxShield).toBe(0)
      expect(Math.abs(b.monthlySavings - a.monthlySavings - a.taxShield)).toBeLessThan(CENTS)
    }
  })

  it('is subtracted from buyer unrecoverable costs', () => {
    const { totals } = simulate(make()).summary
    const expected = totals.interestPaid + totals.maintenance + totals.transactionCosts + totals.finalSellingCost - totals.taxShield
    expect(totals.buyerUnrecoverableCosts).toBeCloseTo(expected, 1)
    expect(totals.taxShield).toBeGreaterThan(0)
  })
})

describe('Buyer timeline', () => {
  it('compounds property value so year-ends match the annual rate', () => {
    const { series } = simulate(make())
    expect(at(series, 12).propertyValue).toBe(517_500)
    expect(at(series, 120).propertyValue).toBeCloseTo(500_000 * 1.035 ** 10, 1)
  })

  it('resets maintenance to % of value at the start of each year', () => {
    const { series } = simulate(make())
    expect(at(series, 1).maintenance).toBe(625)
    expect(at(series, 12).maintenance).toBe(625)
    expect(at(series, 13).maintenance).toBe(646.88) // 517,500 × 1.5% / 12
  })

  it('NW_buy = V − B − sellingCost', () => {
    const { series, initial } = simulate(make())
    expect(initial.buyerNetWealth).toBe(500_000 - 400_000 - 30_000)
    for (const r of series) {
      expect(r.sellingCost).toBeCloseTo(r.propertyValue * 0.06, 1)
      expect(Math.abs(r.buyerNetWealth - (r.propertyValue - r.loanBalance - r.sellingCost))).toBeLessThan(CENTS)
    }
  })

  it('allows underwater mortgages (negative NW_buy, not floored)', () => {
    const { series } = simulate(make({ property: { appreciationRate: -8, downPaymentPct: 5 } }))
    const underwater = series.filter((r) => r.propertyValue < r.loanBalance)
    expect(underwater.length).toBeGreaterThan(0)
    for (const r of underwater) {
      expect(r.buyerNetWealth).toBeLessThan(0)
      expect(Math.abs(r.buyerNetWealth - (r.propertyValue - r.loanBalance - r.sellingCost))).toBeLessThan(CENTS)
    }
  })

  it('post-mortgage era: EMI drops to 0, only maintenance remains', () => {
    const { series } = simulate(make({ property: { loanTenureYears: 10 }, settings: { timeHorizonYears: 20 } }))
    expect(series).toHaveLength(240)
    expect(at(series, 120).loanPayment).toBeGreaterThan(0)
    expect(at(series, 120).loanBalance).toBe(0)
    for (const r of series.slice(120)) {
      expect(r.loanPayment).toBe(0)
      expect(r.interestPaid).toBe(0)
      expect(r.taxShield).toBe(0)
      expect(r.loanBalance).toBe(0)
      expect(r.buyerOutflow).toBe(r.maintenance)
    }
  })
})

describe('Renter timeline', () => {
  it('seeds the portfolio with down payment + closing costs', () => {
    const { initial } = simulate(make())
    expect(initial.portfolioValue).toBe(115_000)
    expect(initial.costBasis).toBe(115_000)
    expect(initial.renterNetWealth).toBe(115_000)
  })

  it('escalates rent annually', () => {
    const { series } = simulate(make())
    expect(at(series, 12).rent).toBe(2000)
    expect(at(series, 13).rent).toBe(2060)
    expect(at(series, 25).rent).toBe(2121.8)
  })

  it('S_m = buyer outflow − rent and P_t = P_{t−1}(1 + r/12) + S_m', () => {
    const { series, initial } = simulate(make())
    const r1 = at(series, 1)
    expect(r1.monthlySavings).toBeCloseTo(r1.loanPayment + r1.maintenance - r1.taxShield - r1.rent, 1)
    expect(r1.portfolioValue).toBeCloseTo(initial.portfolioValue * (1 + 0.07 / 12) + r1.monthlySavings, 1)
  })

  it('matches an independent float implementation of the PRD formulas (positive savings)', () => {
    const inputs = make({ rent: { monthlyRent: 500, annualEscalationRate: 0 } })
    const { series } = simulate(inputs)
    expect(series.every((r) => r.monthlySavings >= 0)).toBe(true)
    const ref = referenceModel(inputs)
    series.forEach((r, idx) => {
      expect(Math.abs(r.buyerNetWealth - ref[idx].buy)).toBeLessThan(0.01)
      expect(Math.abs(r.renterNetWealth - ref[idx].rent)).toBeLessThan(0.01)
    })
  })

  it('taxes only positive gains (no tax on losses)', () => {
    const { series } = simulate(make({ market: { investmentReturnRate: -5 } }))
    const last = series[series.length - 1]
    expect(last.portfolioValue).toBeLessThan(last.costBasis)
    expect(last.capitalGainsTaxLiability).toBe(0)
    expect(last.renterNetWealth).toBe(last.portfolioValue)
  })

  it('NW_rent = P when capital gains rate is 0', () => {
    const { series } = simulate(make({ taxes: { capitalGainsRate: 0 } }))
    expect(series.every((r) => r.renterNetWealth === r.portfolioValue)).toBe(true)
  })
})

describe('Negative savings drain (rent > buying costs)', () => {
  const drain = (mode: 'floor' | 'debt') => simulate(make({ rent: { monthlyRent: 5000 }, settings: { negativePortfolioMode: mode } }))

  it('deducts the shortfall from the portfolio', () => {
    const { series, initial } = drain('floor')
    expect(at(series, 1).monthlySavings).toBeLessThan(0)
    expect(at(series, 1).portfolioValue).toBeLessThan(initial.portfolioValue)
    // Realized gains on withdrawals are taxed; basis never goes negative.
    expect(series.every((r) => r.costBasis >= 0)).toBe(true)
  })

  it('floor mode: portfolio caps at 0 and the uncovered amount is reported', () => {
    const { series, summary } = drain('floor')
    expect(series.some((r) => r.portfolioValue === 0)).toBe(true)
    expect(series.every((r) => r.portfolioValue >= 0 && r.renterNetWealth >= 0 && r.renterDebt === 0)).toBe(true)
    expect(summary.totals.unfundedShortfall).toBeGreaterThan(0)
    expect(summary.totals.capitalGainsTaxPaidOnWithdrawals).toBeGreaterThan(0)
  })

  it('debt mode: shortfall accrues as high-interest debt and NW_rent goes negative', () => {
    const floor = drain('floor').summary
    const { series, summary } = drain('debt')
    const last = series[series.length - 1]
    expect(summary.totals.unfundedShortfall).toBe(0)
    expect(last.portfolioValue).toBe(0)
    expect(last.renterNetWealth).toBe(-last.renterDebt)
    expect(last.renterDebt).toBeGreaterThan(floor.totals.unfundedShortfall) // interest compounds
    const firstDebt = series.findIndex((r) => r.renterDebt > 0)
    expect(firstDebt).toBeGreaterThan(0)
    expect(series[firstDebt + 1].renterDebt).toBeGreaterThan(series[firstDebt].renterDebt)
  })
})

describe('Illiquid vs liquid wealth ("Forever Home") toggle', () => {
  it('excludes property value and selling costs from buyer wealth', () => {
    const { series, summary } = simulate(
      make({ property: { loanTenureYears: 10 }, settings: { timeHorizonYears: 15, includeHomeSaleInWealth: false } }),
    )
    for (const r of series) {
      expect(r.sellingCost).toBe(0)
      expect(r.buyerNetWealth).toBe(r.loanBalance === 0 ? 0 : -r.loanBalance)
    }
    expect(at(series, 180).buyerNetWealth).toBe(0)
    expect(summary.totals.finalSellingCost).toBe(0)
  })
})

describe('Break-even & summary', () => {
  it('detects when the buyer overtakes, with interpolated exact month', () => {
    const { series, initial, summary } = simulate(
      make({ property: { appreciationRate: 6 }, rent: { monthlyRent: 3500 }, market: { investmentReturnRate: 4 } }),
    )
    const be = summary.breakEven
    expect(be).not.toBeNull()
    if (!be) return
    const before = be.month === 1 ? initial : at(series, be.month - 1)
    const after = at(series, be.month)
    expect(before.netWealthDifference).toBeLessThan(0)
    expect(after.netWealthDifference).toBeGreaterThan(0)
    const d0 = before.netWealthDifference
    const d1 = after.netWealthDifference
    expect(be.exactMonth).toBeCloseTo(be.month - 1 + d0 / (d0 - d1), 3)
    expect(be.years).toBeCloseTo(be.exactMonth / 12, 3)
    expect(summary.winner).toBe('buy')
  })

  it('returns null when buying never catches up', () => {
    const { summary } = simulate(
      make({ property: { appreciationRate: 0 }, rent: { monthlyRent: 500, annualEscalationRate: 0 }, market: { investmentReturnRate: 10 } }),
    )
    expect(summary.breakEven).toBeNull()
    expect(summary.winner).toBe('rent')
    expect(summary.finalDifference).toBeLessThan(0)
  })

  it('summary cards match the final series row', () => {
    const { series, summary } = simulate(make())
    const last = series[series.length - 1]
    expect(summary.finalBuyerNetWealth).toBe(last.buyerNetWealth)
    expect(summary.finalRenterNetWealth).toBe(last.renterNetWealth)
    expect(summary.upfrontCash).toBe(115_000)
  })
})

describe('Robustness', () => {
  it('produces one row per month over a 40-year horizon', () => {
    const { series } = simulate(make({ settings: { timeHorizonYears: 40 } }))
    expect(series).toHaveLength(480)
    expect(series[0].month).toBe(1)
    expect(series[479]).toMatchObject({ month: 480, year: 40 })
    for (const row of series) for (const v of Object.values(row)) expect(Number.isFinite(v)).toBe(true)
  })

  it('is pure and deterministic (does not mutate inputs)', () => {
    const inputs = make()
    const frozen = structuredClone(inputs)
    const a = simulate(inputs)
    const b = simulate(inputs)
    expect(inputs).toEqual(frozen)
    expect(a).toEqual(b)
  })

  it.each([
    ['price 0', make({ property: { price: 0 } })],
    ['down payment > 100%', make({ property: { downPaymentPct: 120 } })],
    ['loan with 0-year tenure', make({ property: { loanTenureYears: 0 } })],
    ['horizon 0', make({ settings: { timeHorizonYears: 0 } })],
    ['fractional horizon', make({ settings: { timeHorizonYears: 2.5 } })],
    ['NaN rent', make({ rent: { monthlyRent: Number.NaN } })],
    ['capital gains > 100%', make({ taxes: { capitalGainsRate: 150 } })],
  ])('rejects invalid input: %s', (_, inputs) => {
    expect(() => simulate(inputs)).toThrow(SimulationInputError)
  })
})
