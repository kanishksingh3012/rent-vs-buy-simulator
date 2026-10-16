import { useMemo } from 'react'
import { ControlPanel } from './components/simulator/ControlPanel'
import { SummaryMetrics } from './components/simulator/SummaryMetrics'
import { WealthChart } from './components/simulator/WealthChart'
import { simulate } from './engine'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { selectInputs, useSimulatorStore } from './store/useSimulatorStore'

export default function App() {
  const state = useSimulatorStore()
  const inputs = selectInputs(state)
  // Debounced so dragging a slider doesn't re-run the O(N) engine every frame (TRD §6).
  const debouncedInputs = useDebouncedValue(inputs, 50)
  const result = useMemo(() => simulate(debouncedInputs), [debouncedInputs])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold sm:text-2xl">Rent vs. Buy Simulator</h1>
        <p className="text-sm text-muted">Compare long-term net wealth from buying a home vs. renting and investing the difference.</p>
      </header>

      <main className="grid grid-cols-1 gap-6 p-4 sm:p-8 lg:grid-cols-[380px_1fr]">
        {/* Mobile: chart + summary first (sticky), controls below. Desktop: controls left, results right. */}
        <div className="order-2 lg:order-1">
          <ControlPanel state={state} />
        </div>

        <div className="order-1 flex flex-col gap-4 sm:gap-6 lg:order-2 lg:sticky lg:top-8 lg:self-start">
          <SummaryMetrics summary={result.summary} horizonYears={state.settings.timeHorizonYears} />
          <WealthChart series={result.series} initial={result.initial} summary={result.summary} />
        </div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted sm:px-8">
        Runs entirely in your browser — no account, no server, nothing stored or sent anywhere.
      </footer>
    </div>
  )
}
