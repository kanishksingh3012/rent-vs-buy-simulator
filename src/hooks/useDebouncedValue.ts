import { useEffect, useState } from 'react'

/**
 * Debounces a fast-changing value (e.g. a slider mid-drag) so expensive work
 * downstream — the O(N) FinancialEngine simulation — runs at most once per
 * `delayMs`, per TRD §6 (keep the chart at >=60 FPS while dragging).
 */
export function useDebouncedValue<T>(value: T, delayMs = 50): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])

  return debounced
}
