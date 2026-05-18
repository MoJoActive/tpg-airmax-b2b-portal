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
  proceedingCheckoutFn: () => boolean;
  location: Location;
  quoteId: string;
  quoteUuid?: string;
  navigate?: NavigateFunction;
}

export const handleQuoteCheckout = async ({
  role,
  proceedingCheckoutFn,
  location,
  quoteId,
  quoteUuid,
  navigate,
}: QuoteCheckout) => {
  try {
    store.dispatch(setQuoteDetailToCheckoutUrl(''));

    const isHideQuoteCheckout = proceedingCheckoutFn();

    if (isHideQuoteCheckout) return;

    const {
      storefrontProductSettings: { hidePriceFromGuests },
    } = await getBCStorefrontProductSettings();

    if (hidePriceFromGuests && +role === 100 && navigate) {
      store.dispatch(setQuoteDetailToCheckoutUrl(location.pathname + location.search));
      navigate('/login');
      return;
    }

    const fn = +role === 99 ? bcQuoteCheckout : b2bQuoteCheckout;
    const date = getSearchVal(location.search, 'date');

    // BigCommerce now requires a non-null uuid on quoteCheckout. Bail with a
    // clear log if we somehow got here without one rather than firing a request
    // the server will reject.
    if (!quoteUuid) {
      b2bLogger.error('handleQuoteCheckout: missing quoteUuid; aborting checkout.');
      return;
    }

    const res = await fn({
      id: +quoteId,
      uuid: quoteUuid,
    });

    setQuoteToStorage(quoteId, date);
    const {
      quoteCheckout: {
        quoteCheckout: { checkoutUrl, cartId },
      },
    } = res;

    if (platform === 'bigcommerce') {
      window.location.href = checkoutUrl;
      return;
    }

    await attemptCheckoutLoginAndRedirect(cartId, checkoutUrl as string);
  } catch (err) {
    b2bLogger.error(err);
  }
};

export default handleQuoteCheckout;
