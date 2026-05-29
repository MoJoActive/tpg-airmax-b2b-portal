import { useContext, useEffect } from 'react';

import { CHECKOUT_URL } from '@/constants';
import { DynamicallyVariableedContext } from '@/shared/dynamicallyVariable';
import { GlobaledContext } from '@/shared/global';

const useSetOpen = (isOpen: boolean, _?: string, params?: CustomFieldItems) => {
  const { dispatch } = useContext(GlobaledContext);

  const { dispatch: dispatchMsg } = useContext(DynamicallyVariableedContext);
  useEffect(() => {
    // BC's stencil checkout owns body scroll — do not mutate it here.
    if (window.location.pathname.includes(CHECKOUT_URL)) return;

    // Snapshot body styles before any mutation so cleanup can always restore them.
    const prevOverflow = document.body.style.overflow;
    const prevHeight = document.body.style.height;
    const prevPosition = document.body.style.position;

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
      document.body.style.height = prevHeight;
      document.body.style.overflow = prevOverflow;

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
      // Restore body styles on effect teardown (isOpen flip or component unmount).
      document.body.style.overflow = prevOverflow;
      document.body.style.height = prevHeight;
      document.body.style.position = prevPosition;
    };
    // ignore dispatch and dispatchMsg as they are not reactive values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, params?.quoteBtn, params?.shoppingListBtn]);
};

export default useSetOpen;
