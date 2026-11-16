import { BcCalculatedPrice } from '@/types/products';

export function getQuoteTaxRate(
  catalogPrice: BcCalculatedPrice | undefined,
  configuredPercent: number | undefined,
  decimalPlaces: number,
) {
  const configuredRate = (configuredPercent ?? 0) / 100;
  if (!catalogPrice || catalogPrice.tax_exclusive <= 0) return configuredRate;

  const { tax_exclusive: exclusive, tax_inclusive: inclusive } = catalogPrice;
  const tax = inclusive - exclusive;
  // Prefer the configured rate when it agrees with the rounded catalog tax.
  const roundingTolerance = 0.5 * 10 ** -decimalPlaces;
  if (tax > 0 && Math.abs(exclusive * configuredRate - tax) < roundingTolerance) {
    return configuredRate;
  }
  return tax / exclusive;
}

export function getQuoteLineTax(
  unitPrice: number,
  quantity: number,
  rate: number,
  enteredInclusiveTax: boolean,
) {
  const tax = unitPrice * quantity * rate;
  return enteredInclusiveTax ? tax / (1 + rate) : tax;
}

interface QuoteTaxLine {
  productId: number | string;
  variantId: number | string;
  quantity: number | string;
  offeredPrice: number | string;
}

interface CheckoutTaxLine {
  productId: number;
  variantId: number;
  quantity: number;
  extendedSalePrice: number;
  isTaxable: boolean;
}

export function estimateQuoteTax(
  quoteLines: QuoteTaxLine[],
  checkoutLines: CheckoutTaxLine[],
  checkoutTax: number,
  checkoutPricesIncludeTax: boolean,
  quotePricesIncludeTax: boolean,
  decimalPlaces: number,
): number | null {
  if (!Number.isFinite(checkoutTax) || !checkoutLines.length) return null;

  const checkoutSubtotal = checkoutLines.reduce(
    (sum, line) => sum + (line.isTaxable ? line.extendedSalePrice : 0),
    0,
  );
  const quotedTaxableSubtotal = quoteLines.reduce<number | null>((sum, quoteLine) => {
    const matchingLine = checkoutLines.find(
      (line) => line.productId === +quoteLine.productId && line.variantId === +quoteLine.variantId,
    );
    const quotedLineTotal = +quoteLine.offeredPrice * +quoteLine.quantity;
    if (sum === null || !matchingLine || !Number.isFinite(quotedLineTotal)) return null;
    return sum + (matchingLine.isTaxable ? quotedLineTotal : 0);
  }, 0);

  if (quotedTaxableSubtotal === null) return null;
  if (checkoutTax === 0) return 0;
  // Checkout returns aggregate tax for the shipping address. Scale its effective
  // rate to the quote's taxable merchandise, using the same inclusive/exclusive basis.
  const checkoutNet = checkoutSubtotal - (checkoutPricesIncludeTax ? checkoutTax : 0);
  const comparableSubtotal = checkoutNet + (quotePricesIncludeTax ? checkoutTax : 0);
  if (!Number.isFinite(comparableSubtotal) || comparableSubtotal <= 0) return null;
  return Number(
    ((quotedTaxableSubtotal * checkoutTax) / comparableSubtotal).toFixed(decimalPlaces),
  );
}
