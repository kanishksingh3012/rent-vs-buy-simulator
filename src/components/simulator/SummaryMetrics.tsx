import { Card, Chip } from '@heroui/react'
import type { SimulationSummary } from '../../engine'
import { formatMoney, formatMoneyCompact } from '../../lib/format'

interface SummaryMetricsProps {
  summary: SimulationSummary
  horizonYears: number
}

const winnerCopy = {
  buy: { label: 'Buying wins', color: 'success' as const },
  rent: { label: 'Renting wins', color: 'accent' as const },
  tie: { label: "It's a tie", color: 'default' as const },
}

export function SummaryMetrics({ summary, horizonYears }: SummaryMetricsProps) {
  const winner = winnerCopy[summary.winner]
  const diffAbs = Math.abs(summary.finalDifference)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card.Root className="col-span-2 sm:col-span-1">
        <Card.Content className="flex flex-col gap-1 p-4">
          <Card.Description>Buyer net wealth</Card.Description>
          <Card.Title className="text-xl">{formatMoneyCompact(summary.finalBuyerNetWealth)}</Card.Title>
          <span className="text-xs text-muted">after {horizonYears} yrs</span>
        </Card.Content>
      </Card.Root>

      <Card.Root className="col-span-2 sm:col-span-1">
        <Card.Content className="flex flex-col gap-1 p-4">
          <Card.Description>Renter net wealth</Card.Description>
          <Card.Title className="text-xl">{formatMoneyCompact(summary.finalRenterNetWealth)}</Card.Title>
          <span className="text-xs text-muted">after {horizonYears} yrs</span>
        </Card.Content>
      </Card.Root>

      <Card.Root className="col-span-1">
        <Card.Content className="flex flex-col gap-1 p-4">
          <Card.Description>Break-even</Card.Description>
          <Card.Title className="text-xl">{summary.breakEven ? `Yr ${summary.breakEven.years.toFixed(1)}` : 'Never'}</Card.Title>
          <span className="text-xs text-muted">{summary.breakEven ? 'buying overtakes renting' : 'within horizon'}</span>
        </Card.Content>
      </Card.Root>

      <Card.Root className="col-span-1">
        <Card.Content className="flex flex-col gap-2 p-4">
          <Card.Description>Result</Card.Description>
          <Chip.Root color={winner.color} className="self-start">
            <Chip.Label>{winner.label}</Chip.Label>
          </Chip.Root>
          <span className="text-xs text-muted">by {formatMoney(diffAbs)}</span>
        </Card.Content>
      </Card.Root>
    </div>
  )
}
