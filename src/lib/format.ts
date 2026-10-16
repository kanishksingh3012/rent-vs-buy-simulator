const currency0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const currency2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

export const formatMoney = (n: number): string => currency0.format(n)
export const formatMoneyPrecise = (n: number): string => currency2.format(n)
export const formatMoneyCompact = (n: number): string => compact.format(n)
export const formatPercent = (n: number): string => `${n.toFixed(1).replace(/\.0$/, '')}%`
export const formatYears = (n: number): string => `${n.toFixed(1)} yr`
