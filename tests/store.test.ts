import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_INPUTS, simulate } from '../src/engine'
import { selectInputs, useSimulatorStore } from '../src/store/useSimulatorStore'

const get = () => useSimulatorStore.getState()

describe('useSimulatorStore', () => {
  beforeEach(() => get().reset())

  it('starts from the default inputs', () => {
    expect(selectInputs(get())).toEqual(DEFAULT_INPUTS)
  })

  it('updates one field immutably, leaving other sections untouched', () => {
    const before = get()
    get().updateProperty('interestRate', 0)
    const after = get()
    expect(after.property.interestRate).toBe(0)
    expect(after.property.price).toBe(before.property.price)
    expect(after.property).not.toBe(before.property)
    expect(after.rent).toBe(before.rent)
  })

  it('exposes every section updater', () => {
    get().updateRent('monthlyRent', 3000)
    get().updateMarket('investmentReturnRate', 9)
    get().updateTaxes('capitalGainsRate', 20)
    get().updateSettings('includeHomeSaleInWealth', false)
    const s = get()
    expect([s.rent.monthlyRent, s.market.investmentReturnRate, s.taxes.capitalGainsRate, s.settings.includeHomeSaleInWealth]).toEqual([
      3000, 9, 20, false,
    ])
  })

  it('reset restores defaults without sharing references with DEFAULT_INPUTS', () => {
    get().updateProperty('price', 1)
    get().reset()
    expect(get().property).toEqual(DEFAULT_INPUTS.property)
    expect(get().property).not.toBe(DEFAULT_INPUTS.property)
  })

  it('feeds the engine directly', () => {
    expect(simulate(selectInputs(get())).series).toHaveLength(DEFAULT_INPUTS.settings.timeHorizonYears * 12)
  })
})
