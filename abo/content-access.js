// Existing read-only access contract; never creates an account or submits a care action.
export async function contentAccessState(auth, doc = document) {
  const host = doc.defaultView, user = auth.currentUser;
  if (!user) return 'free';
  const identity = `${user.uid}:${user.isAnonymous}:${user.emailVerified}`;
  try {
    let value;
    if (host.DemenzKiFreigabe?.refresh) value = await host.DemenzKiFreigabe.refresh();
    else {
      const endpoint = host.DEMENZ_ABO_CONFIG?.translatorGate?.endpoint;
      if (!endpoint) return 'unknown';
      const response = await host.fetch(endpoint + '/access', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return 'unknown'; value = await response.json();
    }
    const current = auth.currentUser;
    if (!current || `${current.uid}:${current.isAnonymous}:${current.emailVerified}` !== identity
      || value?.enabled !== true || value.contract !== 'signup-bonus-v1' || typeof value.paid !== 'boolean') return 'unknown';
    return value.paid ? 'paid' : 'free';
  } catch { return 'unknown'; }
}
