import { ShippingAddress } from '@/types/quotes';
import b2bLogger from '@/utils/b3Logger';
import { baseUrl } from '@/utils/basicConfig';

export const QUOTE_SHIPPING_STORAGE_KEY = 'b2b_quote_shipping_address';

export interface StorefrontShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  stateOrProvince: string;
  stateOrProvinceCode: string;
  countryCode: string;
  postalCode: string;
  phone: string;
}

export interface StoredQuoteShippingPayload {
  version: 1;
  cartId: string;
  address: StorefrontShippingAddress;
  restored?: boolean;
}

const CHECKOUT_INCLUDES =
  'cart.lineItems.physicalItems.options,consignments.availableShippingOptions';

export const mapQuoteShippingToStorefront = (
  shippingAddress: ShippingAddress,
  contactEmail?: string,
): StorefrontShippingAddress | null => {
  const address1 = (shippingAddress.address || '').trim();
  if (!address1) {
    return null;
  }

  return {
    firstName: shippingAddress.firstName || '',
    lastName: shippingAddress.lastName || '',
    email: contactEmail || '',
    company: shippingAddress.companyName || '',
    address1,
    address2: shippingAddress.apartment || '',
    city: shippingAddress.city || '',
    stateOrProvince: shippingAddress.state || '',
    stateOrProvinceCode: shippingAddress.stateCode || '',
    countryCode: shippingAddress.countryCode || '',
    postalCode: shippingAddress.zipCode || '',
    phone: shippingAddress.phoneNumber || '',
  };
};

export const storeQuoteShippingAddress = (address: StorefrontShippingAddress, cartId: string) => {
  const payload: StoredQuoteShippingPayload = {
    version: 1,
    cartId,
    address,
  };
  const serialized = JSON.stringify(payload);

  // Dual-write: Buyer Portal / login flows sometimes call sessionStorage.clear().
  try {
    sessionStorage.setItem(QUOTE_SHIPPING_STORAGE_KEY, serialized);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(QUOTE_SHIPPING_STORAGE_KEY, serialized);
  } catch {
    /* ignore */
  }

  try {
    sessionStorage.removeItem('b2b_quote_shipping_reload_count');
  } catch {
    /* ignore */
  }
};

const getLineItemsForConsignment = (checkout: {
  cart?: {
    lineItems?: {
      physicalItems?: Array<{ id: number | string; quantity: number }>;
    };
  };
}) =>
  (checkout.cart?.lineItems?.physicalItems || []).map((item) => ({
    itemId: item.id,
    quantity: item.quantity,
  }));

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const checkoutApi = (path: string) => `${baseUrl}${path}`;

const applyQuoteShippingOnce = async (
  cartId: string,
  address: StorefrontShippingAddress,
): Promise<boolean> => {
  const checkoutUrl = checkoutApi(
    `/api/storefront/checkouts/${cartId}?include=${CHECKOUT_INCLUDES}`,
  );

  const checkoutRes = await fetch(checkoutUrl, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!checkoutRes.ok) {
    const body = await checkoutRes.text();
    throw new Error(
      `Failed to load checkout before applying quote shipping (${checkoutRes.status}): ${body}`,
    );
  }

  const checkout = await checkoutRes.json();
  const lineItems = getLineItemsForConsignment(checkout);

  if (!lineItems.length) {
    throw new Error('No physical line items found when applying quote shipping');
  }

  const consignments = checkout.consignments || [];
  const include = `?include=${CHECKOUT_INCLUDES}`;

  const response =
    consignments.length > 0
      ? await fetch(
          checkoutApi(
            `/api/storefront/checkouts/${cartId}/consignments/${consignments[0].id}${include}`,
          ),
          {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shippingAddress: address,
              lineItems,
            }),
          },
        )
      : await fetch(checkoutApi(`/api/storefront/checkouts/${cartId}/consignments${include}`), {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              shippingAddress: address,
              lineItems,
            },
          ]),
        });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Failed to apply quote shipping to checkout: ${responseText}`);
  }

  return true;
};

/**
 * Attach (or replace) the checkout consignment shipping address so that
 * checkout-js `setDefaultAddress` sees `currentAddress.address1` and skips
 * applying the B2B company default.
 */
export const applyQuoteShippingToCheckout = async (
  cartId: string,
  address: StorefrontShippingAddress,
): Promise<boolean> => {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await applyQuoteShippingOnce(cartId, address);
      return true;
    } catch (error) {
      b2bLogger.error(error);
      if (attempt < attempts) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(250 * attempt);
      }
    }
  }

  return false;
};

const normalizeKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const addressesRoughlyMatch = (
  a: {
    addressLine1?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    countryCode?: string;
  },
  b: ShippingAddress,
) =>
  normalizeKey(a.addressLine1 || a.address || '') === normalizeKey(b.address || '') &&
  normalizeKey(a.city || '') === normalizeKey(b.city || '') &&
  normalizeKey(a.zipCode || '') === normalizeKey(b.zipCode || '') &&
  (!a.countryCode ||
    !b.countryCode ||
    normalizeKey(a.countryCode) === normalizeKey(b.countryCode || ''));

const toUpdatePayload = (
  node: CustomFieldItems,
  companyId: number,
  overrides: Record<string, unknown> = {},
) => ({
  id: +node.id,
  companyId,
  firstName: node.firstName || '',
  lastName: node.lastName || '',
  addressLine1: node.addressLine1 || node.address || '',
  addressLine2: node.addressLine2 || '',
  country: node.country || '',
  countryCode: node.countryCode || '',
  state: node.state || '',
  stateCode: node.stateCode || '',
  city: node.city || '',
  zipCode: node.zipCode || '',
  phoneNumber: node.phoneNumber || '',
  isShipping: Number(node.isShipping) === 1 ? 1 : 0,
  isBilling: Number(node.isBilling) === 1 ? 1 : 0,
  isDefaultShipping: Number(node.isDefaultShipping) === 1 ? 1 : 0,
  isDefaultBilling: Number(node.isDefaultBilling) === 1 ? 1 : 0,
  label: node.label || '',
  uuid: node.uuid || '',
  company: node.company || '',
  extraFields: node.extraFields || [],
  ...overrides,
});

/**
 * checkout-js SearchableAddressSelect only lists addresses with `b2b.isShipping`.
 * Those come from the B2B company address book. We must create/promote the quote
 * address there and verify it round-trips before redirecting to checkout.
 */
export const ensureQuoteAddressInCompanyBook = async (
  shippingAddress: ShippingAddress,
  companyId?: string | number,
): Promise<boolean> => {
  if (!companyId || !shippingAddress?.address) {
    return false;
  }

  const numericCompanyId = +companyId;

  try {
    const { createB2BAddress, getB2BAddress, updateB2BAddress } = await import(
      '@/shared/service/b2b'
    );

    const loadEdges = async () => {
      const response = await getB2BAddress({
        companyId: numericCompanyId,
        first: 50,
        offset: 0,
      });
      return response?.addresses?.edges || [];
    };

    let edges = await loadEdges();

    const findMatch = (list: { node: CustomFieldItems }[]) =>
      list.find((edge) => addressesRoughlyMatch(edge.node, shippingAddress));

    const previousDefault = edges.find(
      (edge: { node: CustomFieldItems }) => Number(edge.node?.isDefaultShipping) === 1,
    );
    let existing = findMatch(edges);

    if (previousDefault?.node?.id && previousDefault.node.id !== existing?.node?.id) {
      try {
        sessionStorage.setItem(
          'b2b_quote_prev_default_shipping',
          JSON.stringify({
            companyId: numericCompanyId,
            id: previousDefault.node.id,
            addressLine1: previousDefault.node.addressLine1,
          }),
        );
      } catch {
        /* ignore */
      }
      try {
        await updateB2BAddress(
          toUpdatePayload(previousDefault.node, numericCompanyId, {
            isDefaultShipping: 0,
          }),
        );
      } catch {
        /* ignore */
      }
    }

    const label =
      (shippingAddress.label || 'Quote shipping address').toString().slice(0, 200) ||
      'Quote shipping address';

    if (existing?.node) {
      await updateB2BAddress(
        toUpdatePayload(existing.node, numericCompanyId, {
          firstName: existing.node.firstName || shippingAddress.firstName || '',
          lastName: existing.node.lastName || shippingAddress.lastName || '',
          addressLine1:
            existing.node.addressLine1 || existing.node.address || shippingAddress.address || '',
          addressLine2: existing.node.addressLine2 || shippingAddress.apartment || '',
          country: existing.node.country || shippingAddress.country || '',
          countryCode: existing.node.countryCode || shippingAddress.countryCode || '',
          state: existing.node.state || shippingAddress.state || '',
          stateCode: existing.node.stateCode || shippingAddress.stateCode || '',
          city: existing.node.city || shippingAddress.city || '',
          zipCode: existing.node.zipCode || shippingAddress.zipCode || '',
          phoneNumber: existing.node.phoneNumber || shippingAddress.phoneNumber || '',
          isShipping: 1,
          isDefaultShipping: 1,
          label: existing.node.label || label,
          company: existing.node.company || shippingAddress.companyName || '',
        }),
      );
    } else {
      await createB2BAddress({
        companyId: numericCompanyId,
        firstName: shippingAddress.firstName || '',
        lastName: shippingAddress.lastName || '',
        addressLine1: shippingAddress.address || '',
        addressLine2: shippingAddress.apartment || '',
        country: shippingAddress.country || '',
        countryCode: shippingAddress.countryCode || '',
        state: shippingAddress.state || '',
        stateCode: shippingAddress.stateCode || '',
        city: shippingAddress.city || '',
        zipCode: shippingAddress.zipCode || '',
        phoneNumber: shippingAddress.phoneNumber || '',
        isShipping: 1,
        isBilling: 0,
        isDefaultShipping: 1,
        isDefaultBilling: 0,
        label,
        company: shippingAddress.companyName || '',
        extraFields: [],
      });
    }

    // Verify the address is actually in the book with isShipping before checkout.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(800 * attempt);
      // eslint-disable-next-line no-await-in-loop
      edges = await loadEdges();
      existing = findMatch(edges);
      const ok =
        existing?.node &&
        Number(existing.node.isShipping) === 1 &&
        Number(existing.node.isDefaultShipping) === 1;
      if (ok) {
        const addressBookId = existing?.node?.id;
        if (addressBookId != null) {
          try {
            sessionStorage.setItem('b2b_quote_address_book_id', String(addressBookId));
          } catch {
            /* ignore */
          }
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    b2bLogger.error(error);
    return false;
  }
};
