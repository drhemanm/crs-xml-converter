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
 *     userId, country, giin, taxYear, schemaVersion, filingMode,
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
 * The GIIN and the institution name are the filer's own identifiers, not their
 * customers', and they are needed to scope account keys and to show a filer
 * which of their own returns they are looking at.
 */
import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';

export const FILINGS = 'filings';
export const FILING_RECORDS = 'records';

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
  const filingRef = await addDoc(collection(db, FILINGS), {
    userId,
    country: settings.reportingFI.country,
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

/** Every filing this user has made for one institution and reporting year. */
export async function listFilings(db, { userId, country, taxYear }) {
  const snap = await getDocs(query(
    collection(db, FILINGS),
    where('userId', '==', userId),
    where('country', '==', country),
    where('taxYear', '==', taxYear),
    orderBy('createdAt', 'asc'),
    limit(200),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
export async function loadPeriodRecords(db, { userId, country, taxYear }) {
  const filings = await listFilings(db, { userId, country, taxYear });
  if (filings.length === 0) return { filings: [], records: [], reportingFiDocRefId: null };

  const records = [];
  for (const filing of filings) {
    const snap = await getDocs(query(
      collection(db, FILINGS, filing.id, FILING_RECORDS),
      orderBy('sequence', 'asc'),
      limit(1000),
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
