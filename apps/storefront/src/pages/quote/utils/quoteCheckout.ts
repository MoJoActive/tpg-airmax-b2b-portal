import { Location, NavigateFunction } from 'react-router-dom';

import {
  b2bQuoteCheckout,
  bcQuoteCheckout,
  getBCStorefrontProductSettings,
} from '@/shared/service/b2b';
import { setQuoteDetailToCheckoutUrl, store } from '@/store';
import { attemptCheckoutLoginAndRedirect, setQuoteToStorage } from '@/utils/b3checkout';
import b2bLogger from '@/utils/b3Logger';
import { platform } from '@/utils/basicConfig';
import { getSearchVal } from '@/utils/loginInfo';

interface QuoteCheckout {
  role: string | number;
  location: Location;
  quoteId: string;
  quoteUuid?: string;
  navigate?: NavigateFunction;
}

export const handleQuoteCheckout = async ({
  role,
  location,
  quoteId,
  quoteUuid,
  navigate,
}: QuoteCheckout) => {
  try {
    store.dispatch(setQuoteDetailToCheckoutUrl(''));

    const {
      storefrontProductSettings: { hidePriceFromGuests },
    } = await getBCStorefrontProductSettings();

    if (hidePriceFromGuests && +role === 100 && navigate) {
      store.dispatch(setQuoteDetailToCheckoutUrl(location.pathname + location.search));
      navigate('/login');
      return;
    }

    if (!quoteUuid) {
      // BigCommerce requires a non-null uuid on quoteCheckout (enforced May 3, 2026).
      // The QuoteDetail page resolves the uuid before the user can checkout; if we
      // still land here without one, bail rather than send a request that will fail.
      b2bLogger.error('handleQuoteCheckout called without a quoteUuid');
      return;
    }

    const fn = +role === 99 ? bcQuoteCheckout : b2bQuoteCheckout;
    const date = getSearchVal(location.search, 'date');

    const res = await fn({
      id: +quoteId,
      uuid: quoteUuid,
    });

    const checkout = res?.quoteCheckout?.quoteCheckout;

    if (!checkout) {
      return;
    }

    setQuoteToStorage(quoteId, date, quoteUuid);
    const { checkoutUrl, cartId } = checkout;

    if (platform === 'bigcommerce') {
      window.location.href = checkoutUrl;
      return;
    }

    if (platform === 'catalyst') {
      window.location.href = `/checkout?cartId=${cartId}`;
      return;
    }

    await attemptCheckoutLoginAndRedirect(cartId, checkoutUrl as string);
  } catch (err) {
    b2bLogger.error(err);
  }
};

export default handleQuoteCheckout;
