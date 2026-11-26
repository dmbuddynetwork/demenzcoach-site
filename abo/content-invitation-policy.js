// Functional invitation cadence only: no identity, URL, care text or analytics.
export const contentInvitationPolicy = Object.freeze({
  // Frequency Capping (Daniel, 26. Nov 2026: „wenn ich es wegklicke, kommt es sofort wieder“): 30 Min. Pause, höchstens 3 pro Tag.
  firstReadMS: 5000, cooldownMS: 30 * 60000, windowMS: 24 * 3600000, maxAutomatic: 3,
  minimumScrollFraction: .25, furtherBlocks: 6,
  firstFunnelAt: 6, funnelEvery: 12, maxFeedFunnels: 4
});
export const scrollSignupKey = 'demenzcoach.contentSignupCadence.v2';
export function readInvitationCadence(raw, now, policy = contentInvitationPolicy) {
  const fresh = () => ({ version: 2, startedAt: now, expiresAt: now + policy.windowMS, count: 0, lastAt: 0, pendingUntil: 0 });
  if (raw === null) return fresh();
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 2 || !Number.isInteger(value.count) || value.count < 0 || value.count > policy.maxAutomatic
      || !['startedAt','expiresAt','lastAt','pendingUntil'].every(key => Number.isFinite(value[key]))
      || value.startedAt > now || value.lastAt > now || value.startedAt < 0 || value.lastAt < 0
      || value.expiresAt !== value.startedAt + policy.windowMS || value.pendingUntil < 0 || value.pendingUntil > now + 15000) return null;
    if (value.expiresAt <= now) return fresh();
    return { version: 2, startedAt: value.startedAt, expiresAt: value.expiresAt, count: value.count, lastAt: value.lastAt, pendingUntil: value.pendingUntil };
  } catch { return null; }
}
export function invitationCadenceAllows(value, now, policy = contentInvitationPolicy, ownPendingUntil = 0) {
  return Boolean(value && value.count < policy.maxAutomatic
    && (value.lastAt === 0 || now - value.lastAt >= policy.cooldownMS)
    && (value.pendingUntil <= now || value.pendingUntil === ownPendingUntil));
}
export function nextInvitationCadence(value, now, policy = contentInvitationPolicy) {
  return { ...value, count: Math.min(policy.maxAutomatic, value.count + 1), lastAt: now, pendingUntil: 0 };
}
