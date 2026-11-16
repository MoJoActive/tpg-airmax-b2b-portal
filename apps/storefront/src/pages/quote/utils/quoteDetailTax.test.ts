import { estimateQuoteTax, getQuoteLineTax, getQuoteTaxRate } from './quoteDetailTax';

it('applies the shipping-address tax estimate to the synced quote price', () => {
  const quote = [{ productId: 1, variantId: 2, quantity: 2, offeredPrice: '10.00' }];
  const cart = [
    { productId: 1, variantId: 2, quantity: 2, extendedSalePrice: 20.78, isTaxable: true },
  ];

  expect(estimateQuoteTax(quote, cart, 1.25, false, false, 2)).toBe(1.2);
  expect(estimateQuoteTax(quote, cart, 0, false, false, 2)).toBe(0);
});

it('uses the synced unit price and quantity with the configured tax rate', () => {
  const rate = getQuoteTaxRate(
    { as_entered: 10.39, entered_inclusive: false, tax_exclusive: 10.39, tax_inclusive: 11.01 },
    6,
    2,
  );

  expect(getQuoteLineTax(10.39, 2, rate, false).toFixed(2)).toBe('1.25');
  expect(getQuoteLineTax(10, 2, rate, false).toFixed(2)).toBe('1.20');
});

it('extracts tax from inclusive prices and preserves a tax-free catalog price', () => {
  expect(getQuoteLineTax(10.6, 2, 0.06, true).toFixed(2)).toBe('1.20');
  expect(
    getQuoteTaxRate(
      { as_entered: 10, entered_inclusive: false, tax_exclusive: 10, tax_inclusive: 10 },
      6,
      2,
    ),
  ).toBe(0);
});
