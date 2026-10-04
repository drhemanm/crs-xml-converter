/**
 * Cookie consent: one place that reads it, saves it and announces changes.
 *
 * Nothing optional runs before the filer has said yes. With no saved choice,
 * or a choice that cannot be read, every optional category counts as refused.
 */

const KEY = 'cookieConsent';
const DATE_KEY = 'cookieConsentDate';
export const CONSENT_EVENT = 'cookie-consent-changed';

export const REFUSED = Object.freeze({
  necessary: true, analytics: false, marketing: false, functional: false,
});

/** The saved choice, or null when the filer has not made one. */
export function readConsent() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...REFUSED, ...parsed, necessary: true } : null;
  } catch {
    // Blocked storage or a corrupt value: treat as no consent given.
    return null;
  }
}

export function hasConsent(category) {
  const consent = readConsent();
  return Boolean(consent && consent[category] === true);
}

/** Save a choice and tell the running app, so it can start or stop at once. */
export function saveConsent(preferences) {
  const saved = { ...REFUSED, ...preferences, necessary: true };
  const date = new Date();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved));
    window.localStorage.setItem(DATE_KEY, date.toISOString());
  } catch {
    // Storage blocked: the choice applies to this page only.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: saved }));
  return { preferences: saved, date };
}
