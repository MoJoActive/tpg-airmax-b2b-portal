import { bindLinks, initApp, requestIdleCallbackFunction, unbindLinks } from './load-functions';

// Surface the deployed bundle version in DevTools so stale Script Manager pastes can be caught quickly
console.info(`[B3] storefront bundle: ${import.meta.env.VITE_BUILD_HASH ?? 'dev'}`);

// check if the accesed url contains a hashtag
if (window.location.hash.startsWith('#/')) {
  initApp();
} else {
  // load the app when the browser is free
  requestIdleCallbackFunction(initApp);
  // and bind links to load the app
  bindLinks();
  window.addEventListener('beforeunload', unbindLinks);
  // and observe global flag to simulate click
  window.b2b.initializationEnvironment.isInitListener = () => {
    unbindLinks();
    setTimeout(() => window.b2b.initializationEnvironment.clickedLinkElement?.click(), 0);
  };
}
