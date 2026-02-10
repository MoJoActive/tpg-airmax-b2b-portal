export type Environment = 'local' | 'sandbox' | 'production';

const STORE_CONFIG = {
  sq95sgetne: {
    name: 'sandbox' as const,
    b2bClientId: 'dl7c39mdpul6hyc489yk0vzxl6jesyx',
    prosCustomerGroupIds: [3] as readonly number[],
  },
  nldoq9l1qv: {
    name: 'production' as const,
    b2bClientId: '8835u50lkd4dat1xxdx4l2o2yos7184',
    prosCustomerGroupIds: [10] as readonly number[],
  },
} as const;

type StoreHash = keyof typeof STORE_CONFIG;

export const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const storeHash: string = (typeof window !== 'undefined' && window.B3?.setting?.store_hash) || '';

const detectedStore =
  (storeHash as StoreHash) in STORE_CONFIG ? STORE_CONFIG[storeHash as StoreHash] : undefined;

export const environment: Environment = isLocal ? 'local' : detectedStore?.name || 'production';

export const isSandbox = detectedStore?.name === 'sandbox';
export const isProduction = detectedStore?.name === 'production';
export const isDeployed = !isLocal;
export const storeConfig = detectedStore || STORE_CONFIG.sq95sgetne;
