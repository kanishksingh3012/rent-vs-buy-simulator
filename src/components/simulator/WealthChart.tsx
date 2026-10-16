import { Card } from '@heroui/react'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimulationResult, SimulationSummary } from '../../engine'
import { formatMoney, formatMoneyCompact } from '../../lib/format'

interface WealthChartProps {
  series: SimulationResult[]
  initial: SimulationResult
  summary: SimulationSummary
}

interface ChartPoint {
  year: number
  buyerNetWealth: number
  renterNetWealth: number
}

/** Downsample to one point per year for the chart — 480 months of precision isn't visible at this scale. */
function toYearlyPoints(initial: SimulationResult, series: SimulationResult[]): ChartPoint[] {
  const points: ChartPoint[] = [{ year: 0, buyerNetWealth: initial.buyerNetWealth, renterNetWealth: initial.renterNetWealth }]
  for (const row of series) {
    if (row.month % 12 === 0) {
      points.push({ year: row.year, buyerNetWealth: row.buyerNetWealth, renterNetWealth: row.renterNetWealth })
    }
  }
  return points
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm shadow-lg">
      <p className="mb-1 font-medium text-surface-foreground">Year {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatMoney(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function WealthChart({ series, initial, summary }: WealthChartProps) {
  const data = useMemo(() => toYearlyPoints(initial, series), [initial, series])
  const breakEvenYear = summary.breakEven?.years

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Net wealth over time</Card.Title>
        <Card.Description>Homeowner equity vs. a renter's invested savings, year by year.</Card.Description>
      </Card.Header>
      <Card.Content className="p-2">
        {/* Card.Content is itself a flex item (flex:1), so Recharts' height:100% needs this
            explicitly-sized wrapper rather than being set directly on Card.Content. */}
        <div className="h-80 w-full sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="year" tickFormatter={(v: number) => `${v}y`} className="text-xs" tick={{ fill: 'var(--muted)' }} />
              <YAxis tickFormatter={(v: number) => formatMoneyCompact(v)} width={64} className="text-xs" tick={{ fill: 'var(--muted)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {breakEvenYear !== undefined && (
                <ReferenceLine x={Math.round(breakEvenYear)} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'Break-even', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 12 }} />
              )}
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line type="monotone" dataKey="buyerNetWealth" name="Buy" stroke="var(--color-success)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="renterNetWealth" name="Rent" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card.Content>
    </Card.Root>
  )
}
