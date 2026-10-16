import { create } from 'zustand'
import { DEFAULT_INPUTS, type SimulationInputs } from '../engine'

type Section = keyof SimulationInputs
type Updater<S extends Section> = <K extends keyof SimulationInputs[S]>(key: K, value: SimulationInputs[S][K]) => void

export interface SimulatorState extends SimulationInputs {
  updateProperty: Updater<'property'>
  updateRent: Updater<'rent'>
  updateMarket: Updater<'market'>
  updateTaxes: Updater<'taxes'>
  updateSettings: Updater<'settings'>
  reset: () => void
}

const cloneDefaults = (): SimulationInputs => structuredClone(DEFAULT_INPUTS)

export const useSimulatorStore = create<SimulatorState>()((set) => {
  const updater =
    <S extends Section>(section: S): Updater<S> =>
    (key, value) =>
      set((state) => ({ [section]: { ...state[section], [key]: value } }) as Partial<SimulatorState>)

  return {
    ...cloneDefaults(),
    updateProperty: updater('property'),
    updateRent: updater('rent'),
    updateMarket: updater('market'),
    updateTaxes: updater('taxes'),
    updateSettings: updater('settings'),
    reset: () => set(cloneDefaults()),
  }
})

/** Extract the engine inputs (sections keep referential identity → cheap memo deps). */
export const selectInputs = (s: SimulatorState): SimulationInputs => ({
  property: s.property,
  rent: s.rent,
  market: s.market,
  taxes: s.taxes,
  settings: s.settings,
})
