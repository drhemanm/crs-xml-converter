/**
 * The filing ledger.
 *
 * What the institution filed, when, and under which DocRefIds. Without it a
 * correction is impossible: CorrDocRefId has to name the record it replaces,
 * and that reference exists nowhere else once the browser tab is closed.
 *
 * What is stored, deliberately:
 *
 *   filings/{filingId}
 *     userId, country, tan, giin, taxYear, schemaVersion, filingMode,
 *     messageRefId, reportingFiDocRefId, counts, createdAt
 *
 *   filings/{filingId}/records/{recordId}
 *     accountKey (SHA-256, scoped), docRefId, docTypeIndic, corrDocRefId,
 *     sequence
 *
 * What is NOT stored: account numbers, names, balances, TINs, addresses,
 * dates of birth — none of the personal or financial data in the return. The
 * ledger is a list of references. The privacy claim on the front page ("your
 * data never leaves this browser") stays true, and it has to keep being true,
 * so anything added here needs to be checked against that sentence.
 *
 * The TAN, GIIN and institution name are the filer's own identifiers, not their
 * customers', and they are needed to scope account keys and to show a filer
 * which of their own returns they are looking at.
 */
import { IdentifierType, crsInstitutionIdentifier } from './identifiers';
import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';

export const FILINGS = 'filings';
export const FILING_RECORDS = 'records';

/**
 * The institution a ledger entry belongs to, normalised for comparison.
 *
 * One account files for many institutions -- a management company files for
 * every fund and GBC it administers -- so a period is a (user, institution,
 * country, year), never just (user, country, year). Keyed on the identifier
 * the CRS return carries in ReportingFI/IN: the TAN for Mauritius, the GIIN
 * elsewhere (src/crs/identifiers.js).
 */
export function institutionKey(identifier) {
  if (typeof identifier !== 'string') return null;
  const key = identifier.trim().toUpperCase();
  return key || null;
}

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 500;

/**
 * Record a completed filing.
 *
 * Called after the XML exists, never before: a filing that failed to generate
 * must not leave DocRefIds in the ledger that no submitted file ever used, or
 * the next correction points at a record the authority has never seen.
 */
export async function recordFiling(db, {
  userId, settings, result, accountKeys, periodSequenceStart = 0,
}) {
  const identifier = crsInstitutionIdentifier(settings.reportingFI);
  if (!identifier || !institutionKey(identifier.value)) {
    // A filing with no institution belongs to no period, so it could never be
    // found again to correct.
    throw new Error('The institution identifier is required to record a filing.');
  }
  const filingRef = await addDoc(collection(db, FILINGS), {
    userId,
    country: settings.reportingFI.country,
    // Both, always: `tan` being present is also how a filing recorded after
    // the TAN/GIIN split is told apart from one recorded before it.
    // Only where the CRS return is filed under it, so a TAN typed in before
    // switching jurisdiction is not attached to another country's filing.
    tan: identifier.type === IdentifierType.TAN ? identifier.value : null,
    giin: settings.reportingFI.giin || null,
    institutionName: settings.reportingFI.name || null,
    taxYear: settings.taxYear,
    schemaVersion: result.schemaVersion,
    filingMode: result.filingMode,
    messageRefId: result.messageRefId,
    reportingFiDocRefId: result.reportingFiDocRefId,
    recordCount: result.ledgerEntries.length,
    createdAt: serverTimestamp(),
  });

  const entries = result.ledgerEntries;
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    entries.slice(i, i + BATCH_LIMIT).forEach((entry, offset) => {
      const key = accountKeys.get(entry.accountNumber);
      if (!key) {
        // Refuse rather than fall back to the account number. A missing key is
        // a bug in the caller; writing the number instead would quietly break
        // the promise that no customer data leaves the browser.
        throw new Error('Internal error: no account key for a filed record. Filing not recorded.');
      }
      const recordRef = doc(collection(db, FILINGS, filingRef.id, FILING_RECORDS));
      batch.set(recordRef, {
        userId,
        // The hash, never the number. See the header of this file.
        accountKey: key,
        docRefId: entry.docRefId,
        docTypeIndic: entry.docTypeIndic,
        corrDocRefId: entry.corrDocRefId || null,
        // Monotonic across the whole period, so buildLedgerIndex can fold
        // corrections in submission order regardless of read order.
        sequence: periodSequenceStart + i + offset + 1,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return filingRef.id;
}

/**
 * Every filing this user has made for one institution and reporting year.
 *
 * The institution is filtered here rather than in the query so that no new
 * composite index has to be deployed first. That is also why there is no
 * limit: a limit applied before the filter could cut off the very filings
 * being looked for, and a correction would then reference the wrong record.
 */
export async function listFilings(db, {
  userId, institutionId, idType = IdentifierType.GIIN, giin, country, taxYear,
}) {
  const key = institutionKey(institutionId);
  if (!key) {
    // Without an institution the period is ambiguous, and an ambiguous ledger
    // is how one institution's records end up in another's correction.
    throw new Error('The institution identifier is required to read its filing history.');
  }
  const snap = await getDocs(query(
    collection(db, FILINGS),
    where('userId', '==', userId),
    where('country', '==', country),
    where('taxYear', '==', taxYear),
    orderBy('createdAt', 'asc'),
  ));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (idType === IdentifierType.TAN) {
    // Filings recorded before the TAN/GIIN split carry the GIIN only, and
    // their account keys were hashed over it. Matching them to a TAN period
    // is guesswork, and a wrong guess turns a correction into a duplicate new
    // filing. So they are refused, never silently left out.
    const legacy = all.filter((f) => !('tan' in f));
    const entered = institutionKey(giin);
    if (legacy.length > 0 && (!entered || legacy.some((f) => institutionKey(f.giin) === entered))) {
      throw new Error(
        entered
          ? 'This institution has filings for this year recorded under its GIIN, before Mauritius CRS '
            + 'returns moved to the TAN. They cannot be matched to the TAN safely, so corrections are '
            + 'blocked for this period. Contact support to have them re-linked.'
          : 'There are filings for this year recorded under a GIIN, before Mauritius CRS returns moved '
            + 'to the TAN. Enter this institution\'s GIIN as well, so they can be told apart from it.',
      );
    }
    return all.filter((f) => institutionKey(f.tan) === key);
  }

  return all.filter((f) => institutionKey(f.giin) === key);
}

/** Recent filings across all periods, for the filing history view. */
export async function listRecentFilings(db, { userId, max = 50 }) {
  const snap = await getDocs(query(
    collection(db, FILINGS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(max),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Every record filed for a period, across all its filings.
 *
 * This is what buildLedgerIndex folds into "the DocRefId a correction must
 * reference". It has to span filings, not just the most recent one: an account
 * filed in the original return and corrected in a later one is only correct
 * when both are seen.
 */
export async function loadPeriodRecords(db, {
  userId, institutionId, idType, giin, country, taxYear,
}) {
  const filings = await listFilings(db, {
    userId, institutionId, idType, giin, country, taxYear,
  });
  if (filings.length === 0) return { filings: [], records: [], reportingFiDocRefId: null };

  const records = [];
  for (const filing of filings) {
    // The userId filter is what lets the rules admit this query at all: rules
    // are not filters, and a query they cannot prove is owner-only is refused
    // outright. Without it every period with a prior filing was unreadable.
    //
    // No orderBy or limit: buildLedgerIndex sorts by sequence itself, and a
    // limit silently dropped records past it, turning corrections of those
    // accounts into duplicate new filings.
    const snap = await getDocs(query(
      collection(db, FILINGS, filing.id, FILING_RECORDS),
      where('userId', '==', userId),
    ));
    snap.docs.forEach((d) => records.push({ id: d.id, filingId: filing.id, ...d.data() }));
  }

  // The institution record to resend on a correction is the one from the first
  // filing of the period — the original, by definition.
  const original = filings.find((f) => f.reportingFiDocRefId);

  return {
    filings,
    records,
    reportingFiDocRefId: original ? original.reportingFiDocRefId : null,
  };
}

/** Highest sequence used for a period, so the next filing continues the count. */
export function nextSequenceStart(records) {
  return records.reduce((max, r) => Math.max(max, r.sequence || 0), 0);
}
