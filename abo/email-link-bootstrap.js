// Runs before styles/SDKs. Action links are kept in memory only and never become
// analytics, referrer, storage, error-reporting or onward-redirect parameters.
(function (root) {
  'use strict';
  let original = root.location.href;
  const url = new URL(original);
  const context = {
    returnTo: url.searchParams.get('returnTo') || '/de/',
    intent: url.searchParams.get('intent') === 'signin' ? 'signin' : 'link',
    state: url.searchParams.get('state') || ''
  };
  root.history.replaceState(root.history.state, '', url.pathname);
  root.DemenzEmailLinkContext = Object.freeze({ take() {
    const value = { ...context, url: original }; original = ''; return value;
  } });
})(window);
