import { v4 as generateUuid } from 'uuid';

import { searchB2BProducts } from '@/shared/service/b2b';
import { ProductInputType } from '@/types/gql/graphql';
import { OptionListProduct, Product } from '@/types/products';
import { QuoteItem } from '@/types/quotes';

interface PickListQuoteGroup {
  lines: ProductInputType[];
  taxTotal: number;
}

export async function getPickListQuoteLines(
  draft: QuoteItem[],
  pricing: {
    companyId: string | number;
    customerGroupId: string | number;
    decimalPlaces: number;
    enteredInclusiveTax: boolean;
  },
): Promise<(PickListQuoteGroup | undefined)[]> {
  const selections = draft.map(({ node }) => {
    const options = node.productsSearch.allOptions ?? [];
    if (
      !options.length ||
      options.some(({ type }) => type !== 'product_list' && type !== 'product_list_with_images')
    ) {
      return [];
    }

    const selected: OptionListProduct[] = JSON.parse(node.optionList || '[]');
    return options.flatMap(({ id, option_values: values = [] }) => {
      const selection = selected.find(({ optionId, option_id }) => {
        const key = String(optionId ?? option_id);
        return key === `attribute[${id}]` || key === String(id);
      });
      const selectedValue = selection?.optionValue ?? selection?.option_value;
      if (!selectedValue || Number(selectedValue) === 0) return [];

      const productId = values.find((value) => String(value.id) === String(selectedValue))
        ?.value_data?.product_id;
      if (!productId) {
        throw new Error(
          `A selected part for ${node.productName} could not be resolved. Review the selection and try again.`,
        );
      }
      return [Number(productId)];
    });
  });

  const productIds = [...new Set(selections.flat())];
  if (!productIds.length) return [];

  const { productsSearch } = await searchB2BProducts({
    productIds,
    companyId: pricing.companyId,
    customerGroupId: pricing.customerGroupId,
  });
  const products = new Map<number, Product>(
    productsSearch.map((product: Product) => [Number(product.id), product]),
  );
  const scale = 10 ** pricing.decimalPlaces;

  return selections.map((ids, index) => {
    if (!ids.length) return undefined;
    const { node } = draft[index];
    const components = ids.map((id) => {
      const product = products.get(id);
      const variant = product?.variants?.find(({ sku }) => sku === product.sku);
      const price = variant?.bc_calculated_price?.as_entered;
      if (
        !product ||
        !variant?.variant_id ||
        !variant.sku ||
        price == null ||
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
      ) {
        throw new Error(
          `A selected part for ${node.productName} has no usable SKU or price. Review the selection and try again.`,
        );
      }
      return { product, variant, price: Number(price) };
    });

    const catalogTotal = components.reduce((total, component) => total + component.price, 0);
    const quotedPrice = Math.round(Number(node.basePrice || 0) * scale);
    let cumulativeWeight = 0;
    let allocatedPrice = 0;
    let taxInMinorUnits = 0;

    // Round cumulative shares so component unit prices always sum to the quoted unit price.
    const lines = components.map(({ product, variant, price }, componentIndex) => {
      cumulativeWeight += catalogTotal > 0 ? price / catalogTotal : 1 / components.length;
      const cumulativePrice =
        componentIndex === components.length - 1
          ? quotedPrice
          : Math.round(quotedPrice * cumulativeWeight);
      const componentMinorUnits = cumulativePrice - allocatedPrice;
      const componentPrice = (componentMinorUnits / scale).toFixed(pricing.decimalPlaces);
      allocatedPrice = cumulativePrice;

      const { tax_exclusive: exclusive, tax_inclusive: inclusive } = variant.bc_calculated_price;
      const taxablePrice = Number(pricing.enteredInclusiveTax ? inclusive : exclusive);
      const catalogTax = Number(inclusive) - Number(exclusive);
      if (!Number.isFinite(taxablePrice) || !Number.isFinite(catalogTax)) {
        throw new Error(`Tax could not be calculated for ${variant.sku}. Try again.`);
      }
      const taxFraction = taxablePrice > 0 ? catalogTax / taxablePrice : 0;
      taxInMinorUnits += Math.round(componentMinorUnits * node.quantity * taxFraction);

      return {
        productId: Number(product.id),
        variantId: Number(variant.variant_id),
        sku: variant.sku,
        productName: product.name,
        imageUrl: variant.image_url || product.imageUrl || '',
        quantity: node.quantity,
        basePrice: componentPrice,
        offeredPrice: componentPrice,
        discount: '0.00',
        options: [],
        itemId: generateUuid(),
      };
    });
    return { lines, taxTotal: taxInMinorUnits / scale };
  });
}
