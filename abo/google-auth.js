// Native Google OAuth with the same UID/purchase-preservation boundary as email links.
export function createGoogleAccess({ webAuth, config, host = window }) {
  let pending;
  async function hasBinding(user) {
    try {
      const response = await host.fetch(`${config.endpoint}/account-status`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const value = await response.json(); return typeof value?.hasCustomer === 'boolean' ? value.hasCustomer : null;
    } catch { return null; }
  }
  async function start() {
    if (config.signIn?.google !== true) throw Object.assign(new Error(), { code: 'not_enabled' });
    const { auth, sdk } = await webAuth({ anonymous: true });
    const original = auth.currentUser;
    if (!original?.uid) throw Object.assign(new Error(), { code: 'auth_unavailable' });
    const provider = new sdk.GoogleAuthProvider();
    let expectedUser;
    try {
      if (original.providerData?.some(item => item.providerId === 'google.com')) expectedUser = (await sdk.reauthenticateWithPopup(original, provider))?.user;
      else expectedUser = (await sdk.linkWithPopup(original, provider))?.user;
      if (expectedUser?.uid !== original.uid) throw Object.assign(new Error(), { code: 'identity_changed' });
    } catch (error) {
      if (!['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(error?.code)) throw error;
      const credential = sdk.GoogleAuthProvider.credentialFromError(error);
      // No merge or silent loss of a paid/pending/unknown guest identity.
      if (!original.isAnonymous || !credential || auth.currentUser?.uid !== original.uid || await hasBinding(original) !== false) throw Object.assign(new Error(), { code: 'account_collision' });
      if (auth.currentUser?.uid !== original.uid || !auth.currentUser?.isAnonymous) throw Object.assign(new Error(), { code: 'identity_changed' });
      expectedUser = (await sdk.signInWithCredential(auth, credential))?.user;
    }
    const user = expectedUser;
    if (!user?.uid || auth.currentUser?.uid !== user.uid) throw Object.assign(new Error(), { code: 'identity_changed' });
    await user.getIdToken(true);
    if (auth.currentUser?.uid !== user.uid) throw Object.assign(new Error(), { code: 'identity_changed' });
    if (!user.emailVerified || !user.email || !user.providerData?.some(item => item.providerId === 'google.com')) throw Object.assign(new Error(), { code: 'verification_pending' });
    return { user, signedIn: true };
  }
  return { begin() { pending ||= start().finally(() => { pending = null; }); return pending; } };
}
