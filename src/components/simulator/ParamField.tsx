import { NumberField, Slider } from '@heroui/react'

interface ParamFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Suffix shown in the slider output / description, e.g. "%", "yrs". Ignored if `formatOptions` is set. */
  suffix?: string
  formatOptions?: Intl.NumberFormatOptions
  description?: string
}

/**
 * A slider + precise numeric input bound to the same value, used for every
 * numeric simulator parameter. HeroUI v3 ships these as composable
 * react-aria-components primitives, so this wrapper is written once here
 * instead of repeated across the control panel.
 */
export function ParamField({ label, value, onChange, min, max, step = 1, suffix, formatOptions, description }: ParamFieldProps) {
  const format: Intl.NumberFormatOptions | undefined = formatOptions ?? (suffix === '%' ? { style: 'percent', maximumFractionDigits: 2 } : undefined)
  // react-aria's `percent` style expects a 0..1 fraction; our domain values are already "6.5 means 6.5%".
  const toFieldValue = (v: number) => (format?.style === 'percent' ? v / 100 : v)
  const fromFieldValue = (v: number) => (format?.style === 'percent' ? v * 100 : v)
  const fieldStep = format?.style === 'percent' ? step / 100 : step

  return (
    <div className="flex flex-col gap-2">
      <Slider.Root
        value={[value]}
        onChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : vals)}
        minValue={min}
        maxValue={max}
        step={step}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <NumberField.Root
            value={toFieldValue(value)}
            onChange={(v) => !Number.isNaN(v) && onChange(fromFieldValue(v))}
            minValue={toFieldValue(min)}
            maxValue={toFieldValue(max)}
            step={fieldStep}
            formatOptions={format}
            aria-label={label}
            className="w-28"
          >
            <NumberField.Group>
              <NumberField.Input className="text-right" />
            </NumberField.Group>
          </NumberField.Root>
        </div>
        <Slider.Track className="mt-1">
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Root>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
    </div>
  )
}
