import { readConsent, hasConsent, saveConsent, CONSENT_EVENT } from './consent';

beforeEach(() => window.localStorage.clear());

describe('nothing optional runs without a recorded yes', () => {
  it('refuses analytics when no choice has been made', () => {
    expect(readConsent()).toBeNull();
    expect(hasConsent('analytics')).toBe(false);
  });

  it('refuses analytics when the saved choice is corrupt', () => {
    window.localStorage.setItem('cookieConsent', '{not json');
    expect(hasConsent('analytics')).toBe(false);
  });

  it('refuses analytics when storage cannot be read', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasConsent('analytics')).toBe(false);
    getItem.mockRestore();
  });

  it('only a saved true counts, not a truthy string', () => {
    window.localStorage.setItem('cookieConsent', JSON.stringify({ analytics: 'yes' }));
    expect(hasConsent('analytics')).toBe(false);
  });
});

describe('saving a choice', () => {
  it('records it and announces it to the running app', () => {
    const heard = jest.fn();
    window.addEventListener(CONSENT_EVENT, heard);
    saveConsent({ analytics: true });
    window.removeEventListener(CONSENT_EVENT, heard);

    expect(hasConsent('analytics')).toBe(true);
    expect(heard.mock.calls[0][0].detail).toEqual({
      necessary: true, analytics: true, marketing: false, functional: false,
    });
  });

  it('withdrawal is announced too, so collection stops at once', () => {
    saveConsent({ analytics: true });
    const heard = jest.fn();
    window.addEventListener(CONSENT_EVENT, heard);
    saveConsent({ analytics: false });
    window.removeEventListener(CONSENT_EVENT, heard);

    expect(hasConsent('analytics')).toBe(false);
    expect(heard.mock.calls[0][0].detail.analytics).toBe(false);
  });

  it('cannot switch essential cookies off', () => {
    saveConsent({ necessary: false });
    expect(readConsent().necessary).toBe(true);
  });
});
