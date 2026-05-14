const {
  store_hash: storeHash = '',
  channel_id: channelId = 1,
  disable_logout_button: disableLogoutButton = false,
  platform = 'custom',
} = window.B3?.setting || {};

export { storeHash, channelId, disableLogoutButton, platform };

const { VITE_LOCAL_DEBUG } = import.meta.env;

const generateBcStorefrontAPIBaseUrl = () => {
  if (VITE_LOCAL_DEBUG === 'TRUE') return '/bigcommerce';
  if (platform === 'bigcommerce') return window.origin;
  if (channelId === 1) return `https://store-${storeHash}.mybigcommerce.com`;

  return `https://store-${storeHash}-${channelId}.mybigcommerce.com`;
};

export const BigCommerceStorefrontAPIBaseURL = generateBcStorefrontAPIBaseUrl();
export const baseUrl = BigCommerceStorefrontAPIBaseURL;
