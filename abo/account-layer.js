// Anmeldung als Layer von unten statt eigener Seite (Daniel, 26. Nov): derselbe Inhalt wie /abo/konto.html im bekannten Anmelde-Layer.
// Bei jedem Problem öffnet sich ersatzweise die Seite /abo/konto.html wie bisher.
export async function openAccountLayer({ returnTo, en = false, returnFocus = null, fallback }) {
  const go = () => { location.assign(fallback); };
  try {
    if (!window.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
    if (window.DEMENZ_ABO_CONFIG?.signIn?.emailLink !== true) { go(); return; }
    const { mountInlineSignup } = await import('/abo/inline-signup.js');
    const placeholder = document.createElement('div'); document.body.append(placeholder);
    await mountInlineSignup(placeholder, { bonus: 3, en, purpose: 'account', onBegin() {}, returnTo, asSheet: true, returnFocus });
    if (placeholder.isConnected) { placeholder.remove(); go(); }
  } catch { go(); }
}
