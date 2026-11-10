// Native Firebase email-link authentication; no newsletter or answer uploads.
const attemptKey = 'demenzcoach.emailLinkAttempt.v1';
const signupKey = 'demenzcoach.emailSignupCompleted.v1';
const maxAge = 30 * 60 * 1000;
const paths = new Set(['/de/', '/en/dementia-translator/', '/abo/', '/abo/index.html', '/abo/mein-plan.html', '/abo/ueber-mama.html']);
const emailValue = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim()) ? value.trim() : '';
export class EmailAccessError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function safeEmailReturn(value, origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !paths.has(url.pathname) || url.username || url.password) return '/de/';
    const clean = new URL(url.pathname, origin);
    if (url.pathname.startsWith('/abo/')) {
      const checks = { plan: /^(monthly|yearly)$/u, src: /^[A-Za-z0-9_-]{1,60}$/u, c: /^[A-Za-z0-9_-]{1,80}$/u, weiter: /^1$/u, status: /^fertig$/u, session_id: /^cs_[A-Za-z0-9_]{6,240}$/u };
      for (const [key, regex] of Object.entries(checks)) {
        const item = url.searchParams.get(key); if (item && regex.test(item)) clean.searchParams.set(key, item);
      }
    }
    return clean.pathname + clean.search;
  } catch { return '/de/'; }
}
export function emailAccountURL(returnTo, origin, intent = 'link') {
  const query = new URLSearchParams({ returnTo: safeEmailReturn(returnTo, origin), intent: intent === 'signin' ? 'signin' : 'link' });
  return `/abo/konto.html?${query}`;
}
export function createEmailAccess({ webAuth, config, host = window, now = Date.now }) {
  const timeout = async (promise) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new EmailAccessError('auth_unavailable')), 12000); })]); }
    finally { clearTimeout(timer); }
  };
  function forget() { try { host.localStorage.removeItem(attemptKey); } catch {} }
  function attempt() {
    try {
      const item = JSON.parse(host.localStorage.getItem(attemptKey) || 'null');
      if (!/^[a-f0-9]{32}$/u.test(item?.nonce) || !emailValue(item?.email) || !Number.isFinite(item.createdAt) || item.createdAt > now() || now() - item.createdAt >= maxAge
        || !(item.uid === null || typeof item.uid === 'string' && item.uid.length > 0 && item.uid.length <= 128) || !['link', 'signin'].includes(item.intent)) { forget(); return null; }
      return item;
    } catch { forget(); return null; }
  }
  async function context(anonymous = false) { return timeout(webAuth({ anonymous })); }
  async function binding(user) {
    try {
      const response = await host.fetch(`${config.endpoint}/account-status`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return null;
      const value = await response.json();
      return typeof value?.hasCustomer === 'boolean' ? value.hasCustomer : null;
    } catch { return null; }
  }
  function queueSignup() {
    try {
      if (host.localStorage.getItem('demenzcoach.analyticsConsent.v1') === 'granted') host.sessionStorage.setItem(signupKey, JSON.stringify({ expires: now() + 600000 }));
    } catch { /* Analytics is optional, authentication is not. */ }
  }
  return {
    attempt, forget, context,
    async begin({ email, returnTo = '/de/', intent = 'link' }) {
      if (config.signIn?.emailLink !== true) throw new EmailAccessError('not_enabled');
      email = emailValue(email); if (!email) throw new EmailAccessError('invalid_email');
      const pending = attempt();
      if (pending && now() - pending.createdAt < 60000) throw new EmailAccessError('wait_before_resend');
      const value = await context(intent !== 'signin');
      const nonce = Array.from(host.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const target = safeEmailReturn(returnTo, host.location.origin);
      const url = new URL('/abo/email-link.html', host.location.origin);
      url.searchParams.set('state', nonce);
      // Only the fixed return pathname crosses Firebase/email. Checkout session
      // references and local questions never go into the authentication link.
      url.searchParams.set('returnTo', target.split('?')[0]);
      const item = { nonce, email, uid: value.auth.currentUser?.uid || null, intent: intent === 'signin' ? 'signin' : 'link', target, createdAt: now() };
      try { host.localStorage.setItem(attemptKey, JSON.stringify(item)); }
      catch { throw new EmailAccessError('storage_unavailable'); }
      try { await timeout(value.sdk.sendSignInLinkToEmail(value.auth, email, { url: url.href, handleCodeInApp: true })); }
      catch (error) { forget(); throw error; }
      return { target };
    },
    async inspect(url, state) {
      const value = await context(false);
      const callback = value.sdk.isSignInWithEmailLink(value.auth, url);
      const pending = attempt();
      return { callback, pending: callback && pending?.nonce === state ? pending : null, user: value.auth.currentUser };
    },
    async finish({ email, url, state, returnTo = '/de/' }) {
      const value = await context(false);
      if (!value.sdk.isSignInWithEmailLink(value.auth, url)) throw new EmailAccessError('invalid_link');
      const pending = attempt();
      const matched = Boolean(pending && pending.nonce === state);
      email = emailValue(email || (matched ? pending.email : ''));
      if (!email) throw new EmailAccessError('email_required');
      if (matched && email.toLowerCase() !== pending.email.toLowerCase()) throw new EmailAccessError('email_mismatch');
      const current = value.auth.currentUser;
      if (matched && pending.uid && current?.uid !== pending.uid) throw new EmailAccessError('original_browser_required');
      const credential = value.sdk.EmailAuthProvider.credentialWithLink(email, url);
      const wantsLink = matched && pending.uid && (pending.intent === 'link' || current?.isAnonymous || !current?.emailVerified);
      if (wantsLink) {
        try {
          if (current.email?.toLowerCase() === email.toLowerCase() && current.providerData?.some((provider) => provider.providerId === 'password')) {
            await timeout(value.sdk.reauthenticateWithCredential(current, credential));
          } else await timeout(value.sdk.linkWithCredential(current, credential));
          if (value.auth.currentUser?.uid !== pending.uid) throw new EmailAccessError('identity_changed');
        } catch (error) {
          if (!['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(error.code)) throw error;
          // A paid/pending or unknown guest identity may never be abandoned.
          if (pending.intent !== 'signin' || !current.isAnonymous || await binding(current) !== false) throw new EmailAccessError('account_collision');
          await timeout(value.sdk.signInWithCredential(value.auth, credential));
        }
      } else {
        if (current?.isAnonymous && await binding(current) !== false) throw new EmailAccessError('original_browser_required');
        if (current && !current.isAnonymous && !current.emailVerified) throw new EmailAccessError('original_browser_required');
        if (current?.emailVerified && current.email?.toLowerCase() !== email.toLowerCase()) throw new EmailAccessError('account_collision');
        if (current?.emailVerified) await timeout(value.sdk.reauthenticateWithCredential(current, credential));
        else await timeout(value.sdk.signInWithCredential(value.auth, credential));
      }
      const user = value.auth.currentUser;
      await timeout(user?.getIdToken(true));
      if (!user?.emailVerified || !user.email || user.email.toLowerCase() !== email.toLowerCase()) throw new EmailAccessError('verification_pending');
      forget(); queueSignup();
      return { user, target: safeEmailReturn(matched ? pending.target : returnTo, host.location.origin) };
    }
  };
}
