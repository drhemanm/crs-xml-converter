/**
 * Error reports must never carry customer data: account data never leaves the
 * browser, and an error report would be a way out.
 */
import { redact, scrubEvent, isDataRejection, reportError } from './monitoring';

describe('redact', () => {
  // Equivalence partitions: quoted values, unquoted numbers, emails, plain text.
  it.each([
    ['Account balance: "1,234,567.89" is not a valid amount.', 'Account balance: "[redacted]" is not a valid amount.'],
    ['row for account MU0011223344 failed', 'row for account MU[n] failed'],
    ['balance 1 234 567.89 rejected', 'balance [n] rejected'],
    ['contact jean.dupont@example.com', 'contact [email]'],
    ['Missing or insufficient permissions.', 'Missing or insufficient permissions.'],
  ])('%s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  // Apostrophes inside a value split the quoting; the value must still not
  // survive. (Real MRA messages name the field and character, not the value.)
  it('does not let a name with an apostrophe through', () => {
    expect(redact("individual.lastName in 'D'Unienville'")).not.toMatch(/Unienville/);
  });

  it('leaves short numbers that carry no data (years, counts) readable', () => {
    expect(redact('row 12 of 2026 failed')).toBe('row 12 of 2026 failed');
  });
});

describe('scrubEvent', () => {
  const event = {
    message: 'Upload of "accounts-confidential.xlsx" failed',
    user: { email: 'filer@bank.mu', id: 'uid-1' },
    extra: { row: { account_number: 'MU0011223344' } },
    request: { url: 'https://app.example/?ref=abc', headers: { Cookie: 'session=1' } },
    exception: { values: [{ type: 'FirebaseError', value: 'Document "users/uid-1" not found' }] },
    breadcrumbs: [
      { category: 'navigation', data: { from: '/', to: '/documentation' } },
      { category: 'ui.click', message: 'button "Generate"' },
      { category: 'console', message: 'Account MU0011223344 balance 1234567.89' },
      { category: 'fetch', data: { url: 'https://firestore.googleapis.com/...' } },
    ],
  };
  const out = scrubEvent(event);

  it('drops the user, extra data, headers and query string', () => {
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ url: 'https://app.example/' });
  });

  it('redacts values from the message and exception', () => {
    expect(out.message).toBe('Upload of "[redacted]" failed');
    expect(out.exception.values[0]).toEqual({ type: 'FirebaseError', value: 'Document "[redacted]" not found' });
  });

  it('keeps only navigation breadcrumbs', () => {
    expect(out.breadcrumbs).toEqual([event.breadcrumbs[0]]);
  });

  it('nothing that looks like an account number survives anywhere', () => {
    expect(JSON.stringify(out)).not.toMatch(/0011223344|1234567|filer@bank/);
  });
});

describe('isDataRejection', () => {
  it('treats a plain refusal of the filer\'s data as expected', () => {
    expect(isDataRejection(new Error('Currency code is required.'))).toBe(true);
  });

  it('treats a Firebase failure as a defect to report', () => {
    const err = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    expect(isDataRejection(err)).toBe(false);
  });

  it('treats a programming error as a defect to report', () => {
    expect(isDataRejection(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
  });
});

it('reportError is a no-op when monitoring is not configured', () => {
  expect(() => reportError(new Error('x'), 'test')).not.toThrow();
});
