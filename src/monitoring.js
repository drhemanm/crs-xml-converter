/**
 * Error monitoring (Sentry).
 *
 * Why it exists: every serious defect found in this product so far failed
 * quietly in a user's browser. Signed-in conversions were refused by the
 * database rules for months, the audit trail never recorded anything, and the
 * filing ledger could not be read. Each was caught and logged to a console
 * nobody was watching. This sends those failures somewhere they are seen.
 *
 * What it must never do: carry customer data. The product's promise is that
 * account data never leaves the browser, and an error report is a way out.
 * So every event is scrubbed before it is sent (scrubEvent, below), and
 * breadcrumbs -- which record clicks, console output and network calls -- are
 * dropped except for page navigation.
 *
 * Off unless REACT_APP_SENTRY_DSN is set at build time.
 */
import * as Sentry from '@sentry/react';

let enabled = false;

// Quoted values are where row data appears in messages ("1,234,567.89" is
// not a valid amount; "D'Unienville"); digit runs catch account numbers,
// TINs and balances that appear unquoted.
//
// Single quotes are matched greedily, first to last on the line: names carry
// apostrophes ('D'Unienville'), and a lazy match would stop at the first one
// and let the rest of the name through. Over-redacting an English contraction
// in an error message is the cheaper mistake.
const QUOTED = /"[^"]*"|'[^\n]*'|‘[^’]*’|“[^”]*”/g;
const DIGITS = /\d[\d.,\s-]{3,}\d/g;
const EMAIL = /[^\s@"']+@[^\s@"']+\.[^\s@"']+/g;

export const redact = (text) =>
  typeof text === 'string'
    ? text.replace(EMAIL, '[email]').replace(QUOTED, '"[redacted]"').replace(DIGITS, '[n]')
    : text;

/** Strips everything from an event that could carry user or customer data. */
export const scrubEvent = (event) => {
  const clean = { ...event };
  delete clean.user;
  delete clean.extra;
  if (clean.request) {
    // The page path is useful and holds no data; query strings, headers and
    // cookies may.
    clean.request = { url: (clean.request.url || '').split('?')[0] };
  }
  if (clean.message) clean.message = redact(clean.message);
  if (clean.exception?.values) {
    clean.exception = {
      ...clean.exception,
      values: clean.exception.values.map((v) => ({ ...v, value: redact(v.value) })),
    };
  }
  clean.breadcrumbs = (clean.breadcrumbs || []).filter((b) => b.category === 'navigation');
  return clean;
};

/**
 * Whether an error is the filer's data being refused -- expected, explained
 * on screen, and not a defect -- rather than a failure of the system.
 *
 * The converter reports bad rows as plain Errors. Firebase failures carry a
 * `code` (permission-denied, unavailable), and programming errors have their
 * own types (TypeError, RangeError). Those are what monitoring is for.
 */
export const isDataRejection = (err) =>
  Boolean(err) && err.name === 'Error' && !err.code;

export function initMonitoring() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    beforeBreadcrumb: (crumb) => (crumb.category === 'navigation' ? crumb : null),
    beforeSend: scrubEvent,
  });
  enabled = true;
  return true;
}

/** Reports a failure. `area` names the operation, e.g. 'ledger.record'. */
export function reportError(err, area) {
  if (!enabled || !err) return;
  Sentry.captureException(err, { tags: { area } });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
