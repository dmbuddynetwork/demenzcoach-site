// Functional account access only; never uploads answers or enrolls a newsletter.
let context, anonymousSignIn;
export async function webAuth({ anonymous = true } = {}) {
  context ||= (async () => {
    const config = window.DEMENZ_ABO_CONFIG;
    if (!config?.firebase?.apiKey) throw new Error('account_unavailable');
    const [app, sdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js')
    ]);
    const auth = sdk.getAuth(app.getApps().find((value) => value.options.projectId === config.firebase.projectId) || app.initializeApp(config.firebase));
    await auth.authStateReady();
    // A successful same-account reauthentication changes lastSignInTime too.
    // Ordinary token refreshes must not look like a newly completed sign-in.
    const identity = user => `${user?.uid || ''}:${user?.isAnonymous}:${user?.emailVerified}:${user?.metadata?.lastSignInTime || ''}`;
    let signature = identity(auth.currentUser);
    sdk.onIdTokenChanged(auth, (user) => {
      const next = identity(user);
      if (next !== signature) { signature = next; window.dispatchEvent(new Event('demenz-auth-changed')); }
    });
    return { sdk, auth };
  })().catch((error) => { context = null; throw error; });
  const value = await context;
  if (anonymous && !value.auth.currentUser) {
    anonymousSignIn ||= value.sdk.signInAnonymously(value.auth).finally(() => { anonymousSignIn = null; });
    await anonymousSignIn;
  }
  return value;
}
