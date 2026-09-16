import b2bLogger from '@/utils/b3Logger';

const ADDRESS_TYPE_FIELD = 'Address Type';

type QuoteAddressExtraField = {
  fieldName?: string;
  fieldValue?: string | number | null;
};

export const getShippingAddressType = (
  shippingAddress?: { extraFields?: QuoteAddressExtraField[] } | null,
): string | null => {
  const extraFields = shippingAddress?.extraFields;
  if (!Array.isArray(extraFields)) return null;

  const match = extraFields.find(
    (field) => String(field?.fieldName ?? '').trim().toLowerCase() === ADDRESS_TYPE_FIELD.toLowerCase(),
  );

  const value = match?.fieldValue;
  if (value === null || value === undefined) return null;

  const trimmed = String(value).trim();
  return trimmed || null;
};

export const setQuoteAddressTypeViaRyzome = async (
  quoteId: string | number,
  addressType: string | null | undefined,
  createdAt?: string | number | null,
): Promise<void> => {
  const trimmed = addressType == null ? '' : String(addressType).trim();
  if (!trimmed) {
    b2bLogger.warn(
      `setQuoteAddressTypeViaRyzome: skipped for quote ${quoteId} — no Address Type on shipping address`,
    );
    return;
  }

  const baseUrl = String(import.meta.env.VITE_RYZOME_URL || '').replace(/\/$/, '');
  const token = String(import.meta.env.VITE_RYZOME_API_TOKEN || '').trim();

  if (!baseUrl || !token) {
    b2bLogger.warn(
      `setQuoteAddressTypeViaRyzome: skipped for quote ${quoteId} — VITE_RYZOME_URL / VITE_RYZOME_API_TOKEN not set`,
    );
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/b2b/quotes/address-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        quoteId,
        addressType: trimmed,
        fieldName: ADDRESS_TYPE_FIELD,
        // Management GET often needs date=MM/DD/YYYY for brand-new quotes.
        ...(createdAt != null && createdAt !== '' ? { createdAt } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      b2bLogger.error(
        `setQuoteAddressTypeViaRyzome: quote ${quoteId} failed (${response.status}) ${body}`,
      );
    }
  }
  catch (error) {
    b2bLogger.error(`setQuoteAddressTypeViaRyzome: quote ${quoteId}`, error);
  }
};
