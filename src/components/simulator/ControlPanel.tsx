import { Accordion, Button, Switch } from '@heroui/react'
import { RotateCcw } from 'lucide-react'
import type { SimulatorState } from '../../store/useSimulatorStore'
import { ParamField } from './ParamField'

interface ControlPanelProps {
  state: SimulatorState
}

const PCT = { suffix: '%' } as const

/** All simulator inputs, grouped into an accordion. Pure presentation — reads/writes the Zustand store directly. */
export function ControlPanel({ state }: ControlPanelProps) {
  const { property, rent, market, taxes, settings } = state
  const hasLoan = property.downPaymentPct < 100

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Your scenario</h2>
        <Button variant="ghost" size="sm" onPress={state.reset}>
          <RotateCcw className="size-4" aria-hidden />
          Reset
        </Button>
      </div>

      <Accordion.Root defaultExpandedKeys={['property', 'rent']} allowsMultipleExpanded>
        <Accordion.Item id="property">
          <Accordion.Heading>
            <Accordion.Trigger>
              Property &amp; Loan
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-5 pb-4">
              <ParamField
                label="Property price"
                value={property.price}
                onChange={(v) => state.updateProperty('price', v)}
                min={50_000}
                max={3_000_000}
                step={5_000}
                formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
              />
              <ParamField
                label="Down payment"
                value={property.downPaymentPct}
                onChange={(v) => state.updateProperty('downPaymentPct', v)}
                min={0}
                max={100}
                step={1}
                {...PCT}
              />
              <ParamField
                label="Loan interest rate"
                value={property.interestRate}
                onChange={(v) => state.updateProperty('interestRate', v)}
                min={0}
                max={15}
                step={0.1}
                {...PCT}
              />
              {hasLoan && (
                <ParamField
                  label="Loan tenure"
                  value={property.loanTenureYears}
                  onChange={(v) => state.updateProperty('loanTenureYears', Math.round(v))}
                  min={1}
                  max={40}
                  step={1}
                  suffix="yrs"
                />
              )}
              <ParamField
                label="Closing costs"
                value={property.closingCostsPct}
                onChange={(v) => state.updateProperty('closingCostsPct', v)}
                min={0}
                max={10}
                step={0.1}
                {...PCT}
                description="Stamp duty, legal fees, and other one-time costs at purchase."
              />
              <ParamField
                label="Annual appreciation"
                value={property.appreciationRate}
                onChange={(v) => state.updateProperty('appreciationRate', v)}
                min={-10}
                max={15}
                step={0.1}
                {...PCT}
              />
              <ParamField
                label="Maintenance & property tax"
                value={property.maintenancePct}
                onChange={(v) => state.updateProperty('maintenancePct', v)}
                min={0}
                max={6}
                step={0.1}
                {...PCT}
                description="Annual cost as a % of the home's current value."
              />
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="rent">
          <Accordion.Heading>
            <Accordion.Trigger>
              Renting
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-5 pb-4">
              <ParamField
                label="Monthly rent"
                value={rent.monthlyRent}
                onChange={(v) => state.updateRent('monthlyRent', v)}
                min={0}
                max={20_000}
                step={50}
                formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
              />
              <ParamField
                label="Annual rent increase"
                value={rent.annualEscalationRate}
                onChange={(v) => state.updateRent('annualEscalationRate', v)}
                min={-5}
                max={15}
                step={0.1}
                {...PCT}
              />
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="market">
          <Accordion.Heading>
            <Accordion.Trigger>
              Market &amp; Taxes
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-5 pb-4">
              <ParamField
                label="Investment return"
                value={market.investmentReturnRate}
                onChange={(v) => state.updateMarket('investmentReturnRate', v)}
                min={-10}
                max={20}
                step={0.1}
                {...PCT}
                description="Expected annualized return on the renter's invested savings."
              />
              <ParamField
                label="Selling cost"
                value={market.sellingCostPct}
                onChange={(v) => state.updateMarket('sellingCostPct', v)}
                min={0}
                max={10}
                step={0.1}
                {...PCT}
                description="Broker fees etc. paid if the home is sold at the end."
              />
              <ParamField
                label="Marginal tax rate"
                value={taxes.marginalTaxRate}
                onChange={(v) => state.updateTaxes('marginalTaxRate', v)}
                min={0}
                max={55}
                step={1}
                {...PCT}
                description="Used for the buyer's mortgage-interest tax deduction."
              />
              <ParamField
                label="Capital gains tax"
                value={taxes.capitalGainsRate}
                onChange={(v) => state.updateTaxes('capitalGainsRate', v)}
                min={0}
                max={55}
                step={1}
                {...PCT}
                description="Applied to realized gains in the renter's portfolio."
              />
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="settings">
          <Accordion.Heading>
            <Accordion.Trigger>
              Settings
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-5 pb-4">
              <ParamField
                label="Time horizon"
                value={settings.timeHorizonYears}
                onChange={(v) => state.updateSettings('timeHorizonYears', Math.round(v))}
                min={1}
                max={50}
                step={1}
                suffix="yrs"
              />
              <Switch.Root
                isSelected={settings.includeHomeSaleInWealth}
                onChange={(checked) => state.updateSettings('includeHomeSaleInWealth', checked)}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm text-foreground">Count home equity as wealth</span>
                </Switch.Content>
              </Switch.Root>
              <p className="text-xs text-muted">
                Off = "Forever Home" mode: the house is treated as a place to live, not an asset — buyer wealth is just
                −(loan balance), with no sale.
              </p>

              <Switch.Root
                isSelected={settings.negativePortfolioMode === 'debt'}
                onChange={(checked) => state.updateSettings('negativePortfolioMode', checked ? 'debt' : 'floor')}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm text-foreground">Model exhausted savings as debt</span>
                </Switch.Content>
              </Switch.Root>
              <p className="text-xs text-muted">
                If renting costs more than owning and the renter's portfolio hits $0, this borrows the shortfall
                instead of simply reporting it as unfunded.
              </p>
              {settings.negativePortfolioMode === 'debt' && (
                <ParamField
                  label="Debt interest rate"
                  value={settings.debtInterestRate ?? 12}
                  onChange={(v) => state.updateSettings('debtInterestRate', v)}
                  min={0}
                  max={36}
                  step={0.5}
                  {...PCT}
                />
              )}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  )
}
