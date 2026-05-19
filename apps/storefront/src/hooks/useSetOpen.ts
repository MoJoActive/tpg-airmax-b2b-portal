import { useContext, useEffect } from 'react';

import { CHECKOUT_URL } from '@/constants';
import { DynamicallyVariableedContext } from '@/shared/dynamicallyVariable';
import { GlobaledContext } from '@/shared/global';

const useSetOpen = (isOpen: boolean, _?: string, params?: CustomFieldItems) => {
  const { dispatch } = useContext(GlobaledContext);

  const { dispatch: dispatchMsg } = useContext(DynamicallyVariableedContext);
  useEffect(() => {
    if (window.location.pathname.includes(CHECKOUT_URL)) return;

    const prevHeight = document.body.style.height;
    const prevOverflow = document.body.style.overflow;

    if (isOpen) {
      // The iframe screen is removed
      document.body.style.height = '100%';
      document.body.style.overflow = 'hidden';
      // The iframe button opens and assigns the url
      dispatch({
        type: 'common',
        payload: {
          openAPPParams: {
            quoteBtn: params?.quoteBtn || '',
            shoppingListBtn: params?.shoppingListBtn || '',
          },
        },
      });

      // close all global tips
      dispatchMsg({
        type: 'common',
        payload: {
          globalTipMessage: {
            msgs: [],
          },
          tipMessage: {
            msgs: [],
          },
        },
      });
    } else {
      // close all tips
      dispatchMsg({
        type: 'common',
        payload: {
          tipMessage: {
            msgs: [],
          },
        },
      });
    }

    return () => {
      document.body.style.height = prevHeight;
      document.body.style.overflow = prevOverflow;
    };
    // ignore dispatch and dispatchMsg as they are not reactive values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, params?.quoteBtn, params?.shoppingListBtn]);
};

export default useSetOpen;
