import { store } from '@/store';
import { clearCompanySlice } from '@/store/slices/company';

export const logoutSession = () => {
  store.dispatch(clearCompanySlice());
};
