import { searchB2BProducts } from '@/shared/service/b2b';
import { QuoteItem } from '@/types/quotes';

import { getPickListQuoteLines } from './pickListQuoteLines';

vi.mock('@/shared/service/b2b', () => ({ searchB2BProducts: vi.fn() }));

const pricing = { companyId: 1, customerGroupId: 2, decimalPlaces: 2 };
const parts = [
  { id: 1, sku: '490503', price: 12.99 },
  { id: 2, sku: '490221', price: 0.71 },
  { id: 3, sku: '490312', price: 2.59 },
  { id: 4, sku: '490309', price: 0.79 },
  { id: 5, sku: '490239', price: 9.74 },
];

const pickList = {
  node: {
    productName: 'PS30 replacement parts',
    variantSku: 'AAMAPS30-PARENT',
    basePrice: 17.08,
    quantity: 1,
    productsSearch: {
      allOptions: parts.map(({ id }) => ({
        id,
        type: 'product_list_with_images',
        option_values: [{ id: id + 100, value_data: { product_id: id } }],
      })),
    },
    optionList: JSON.stringify([
      { option_id: 'attribute[1]', option_value: '101' },
      { option_id: 'attribute[2]', option_value: '102' },
      { optionId: 'attribute[3]', optionValue: '103' },
      { optionId: 'attribute[4]', optionValue: '104' },
    ]),
  },
} as QuoteItem;

it('replaces only selected parts with catalog SKUs and preserves the quoted price', async () => {
  vi.mocked(searchB2BProducts).mockResolvedValue({
    productsSearch: parts.map(({ id, sku, price }) => ({
      id,
      sku,
      name: sku,
      variants: [{ sku, variant_id: id + 200, bc_calculated_price: { as_entered: price } }],
    })),
  });

  const [lines] = await getPickListQuoteLines([pickList], pricing);
  expect(searchB2BProducts).toHaveBeenCalledWith({
    productIds: [1, 2, 3, 4],
    companyId: 1,
    customerGroupId: 2,
  });
  expect(lines.map(({ sku, quantity, offeredPrice }) => [sku, quantity, offeredPrice])).toEqual([
    ['490503', 1, '12.99'],
    ['490221', 1, '0.71'],
    ['490312', 1, '2.59'],
    ['490309', 1, '0.79'],
  ]);

  const [repriced] = await getPickListQuoteLines(
    [{ node: { ...pickList.node, basePrice: 15.01, quantity: 3 } }],
    pricing,
  );
  expect(repriced.every(({ quantity }) => quantity === 3)).toBe(true);
  expect(
    repriced.reduce((sum, { offeredPrice, quantity }) => sum + Number(offeredPrice) * quantity, 0),
  ).toBeCloseTo(45.03);
});
