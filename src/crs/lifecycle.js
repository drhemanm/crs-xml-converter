/**
 * CRS filing lifecycle.
 *
 * A converter turns a spreadsheet into XML once. A filer's actual obligation
 * runs for years: file a return, correct the records the authority rejects,
 * void the ones sent in error, and file a nil return in a year with nothing to
 * report. None of that is possible without remembering what was filed before,
 * because every correction has to point at the DocRefId of the record it
 * replaces.
 *
 * This module is the memory and the rules. It holds no PII: a record is
 * identified by a hash of its account number, never the number itself.
 *
 * The rules encoded here, and where they come from:
 *
 *   - DocTypeIndic OECD1 new, OECD2 correction, OECD3 void, OECD0 resent.
 *   - MessageTypeIndic CRS701 new data, CRS702 corrections, CRS703 no data.
 *     A CRS702 message carries corrections and voids only.
 *   - CorrDocRefId must reference the LATEST DocRefId for that record, not the
 *     original. Correcting a correction points at the correction.
 *   - CorrMessageRefId is forbidden in CRS, in the header and in DocSpec
 *     alike. There is no "correct a message" operation.
 *   - A correction to an AccountReport must arrive with its parent ReportingFI
 *     present. When the institution's own details have not changed it is
 *     resent as OECD0 carrying its ORIGINAL DocRefId.
 *   - A correction replaces the whole record. There is no field-level patch.
 *   - Voiding a ReportingFI does not cascade to its AccountReports.
 */

export const FilingMode = {
  New: 'new',
  Correction: 'correction',
  Void: 'void',
  Nil: 'nil',
};

export const DocTypeIndic = {
  Resent: 'OECD0',
  New: 'OECD1',
  Corrected: 'OECD2',
  Void: 'OECD3',
};

export const MessageTypeIndic = {
  NewData: 'CRS701',
  Corrections: 'CRS702',
  NoData: 'CRS703',
};

/** State a record is in, from the ledger's point of view. */
export const RecordState = {
  /** Filed and current. This is what a correction would replace. */
  Active: 'active',
  /** Replaced by a later correction. Never the target of a new correction. */
  Superseded: 'superseded',
  /** Voided. Cannot be corrected; it has to be re-filed as new data. */
  Voided: 'voided',
};

export const FILING_MODE_LABELS = {
  [FilingMode.New]: 'New return',
  [FilingMode.Correction]: 'Correction',
  [FilingMode.Void]: 'Void records',
  [FilingMode.Nil]: 'Nil return',
};

/**
 * Account identity in the ledger.
 *
 * The ledger has to recognise "this row is the same account as that record"
 * across filings, and it must do so without storing account numbers. The key
 * is a SHA-256 over the account number scoped to the institution and period,
 * so the same number under two institutions produces two different keys and
 * nothing correlates across them.
 *
 * This is a hash, not encryption. An account number whose format is known and
 * whose space is small could be recovered by brute force from a key plus the
 * scope. It is a real reduction in exposure, not a guarantee, and it should
 * not be described as one.
 */
export async function accountKey(accountNumber, scope) {
  // `window.crypto` rather than `globalThis` — the browserslist target this
  // app builds for predates globalThis, and eslint's env reflects that.
  const subtle = typeof window !== 'undefined' && window.crypto && window.crypto.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto is unavailable, so filings cannot be recorded. This needs a ' +
      'secure context (https). The conversion itself is unaffected.',
    );
  }
  const material = `${scope.giin || ''}|${scope.country}|${scope.period}|${accountNumber}`;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Account keys for a whole upload, computed in one pass. */
export async function buildAccountKeys(accountNumbers, scope) {
  const keys = new Map();
  for (const number of accountNumbers) {
    if (number && !keys.has(number)) keys.set(number, await accountKey(number, scope));
  }
  return keys;
}

/**
 * The live picture of a previous filing period: for each account, the DocRefId
 * a correction would have to reference, and whether it can be corrected at all.
 *
 * Ledger entries are folded in submission order, so an account corrected twice
 * ends up pointing at the second correction — which is what CorrDocRefId must
 * carry.
 */
export function buildLedgerIndex(records) {
  const index = new Map();
  const ordered = [...records].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  for (const record of ordered) {
    const existing = index.get(record.accountKey);
    if (existing) existing.state = RecordState.Superseded;

    index.set(record.accountKey, {
      accountKey: record.accountKey,
      docRefId: record.docRefId,
      state: record.docTypeIndic === DocTypeIndic.Void ? RecordState.Voided : RecordState.Active,
      docTypeIndic: record.docTypeIndic,
      accountLabel: record.accountLabel || null,
    });
  }

  return index;
}

/** Message-level indicator for a mode. Void is a correction in CRS terms. */
export function messageTypeIndicFor(mode) {
  switch (mode) {
    case FilingMode.Correction:
    case FilingMode.Void:
      return MessageTypeIndic.Corrections;
    case FilingMode.Nil:
      return MessageTypeIndic.NoData;
    case FilingMode.New:
    default:
      return MessageTypeIndic.NewData;
  }
}

/**
 * DocSpec for the ReportingFI element.
 *
 * On a correction or a void the institution's own record is not what changed,
 * but it has to be present for its children to be addressable. It is resent as
 * OECD0 carrying the DocRefId it was originally filed under — a fresh DocRefId
 * here would make it a different record and orphan the corrections.
 */
export function planReportingFi(mode, previousFiling, mintDocRefId) {
  const isCorrectionLike = mode === FilingMode.Correction || mode === FilingMode.Void;

  if (isCorrectionLike) {
    if (!previousFiling || !previousFiling.reportingFiDocRefId) {
      return {
        error:
          'The original filing\'s institution record could not be found, so a ' +
          'correction cannot reference it. Corrections must be filed from the ' +
          'same account that filed the original return.',
      };
    }
    return {
      docTypeIndic: DocTypeIndic.Resent,
      docRefId: previousFiling.reportingFiDocRefId,
    };
  }

  return { docTypeIndic: DocTypeIndic.New, docRefId: mintDocRefId() };
}

/**
 * Decide what each uploaded row is, in lifecycle terms.
 *
 * `rows` carry `{ accountKey, accountLabel }`. Returns one entry per row: a
 * plan, or a rejection naming the reason in language a filer can act on.
 */
export function planRecords(mode, rows, ledgerIndex, mintDocRefId) {
  const planned = [];
  const rejected = [];
  const seen = new Set();

  for (const row of rows) {
    const { accountKey: key, accountLabel, sourceRow } = row;

    // The same account twice in one message is always an error: the second
    // AccountReport would silently replace the first at the authority, and
    // which one survives is not something to leave to chance.
    if (seen.has(key)) {
      rejected.push({
        row: sourceRow,
        message:
          `Account ${accountLabel} appears more than once in this file. ` +
          'One message may contain only one report per account.',
      });
      continue;
    }
    seen.add(key);

    if (mode === FilingMode.New) {
      const prior = ledgerIndex.get(key);
      if (prior && prior.state === RecordState.Active) {
        rejected.push({
          row: sourceRow,
          message:
            `Account ${accountLabel} was already filed for this period. ` +
            'Filing it again as new data would create a duplicate at the ' +
            'authority — file it as a correction instead.',
        });
        continue;
      }
      planned.push({ ...row, docTypeIndic: DocTypeIndic.New, docRefId: mintDocRefId() });
      continue;
    }

    // Correction and void both need a record to point at.
    const prior = ledgerIndex.get(key);
    if (!prior) {
      rejected.push({
        row: sourceRow,
        message:
          `Account ${accountLabel} was not in the filing being corrected, so ` +
          'there is nothing to reference. File it as new data instead.',
      });
      continue;
    }
    if (prior.state === RecordState.Voided) {
      rejected.push({
        row: sourceRow,
        message:
          `Account ${accountLabel} was voided. A voided record cannot be ` +
          'corrected — file it again as new data.',
      });
      continue;
    }

    planned.push({
      ...row,
      docTypeIndic: mode === FilingMode.Void ? DocTypeIndic.Void : DocTypeIndic.Corrected,
      docRefId: mintDocRefId(),
      corrDocRefId: prior.docRefId,
    });
  }

  return { planned, rejected };
}

/**
 * Whole-message checks that only make sense once every row is planned.
 *
 * These are the conditions an authority rejects the entire file for, so they
 * are worth catching before the filer uploads rather than after.
 */
export function validateFiling(mode, planned) {
  const problems = [];

  if (mode === FilingMode.Nil && planned.length > 0) {
    problems.push(
      'A nil return declares that there is nothing to report, so it cannot ' +
      'contain account reports. Remove the file, or file it as a new return.',
    );
  }

  if (mode !== FilingMode.Nil && planned.length === 0) {
    problems.push(
      'There are no account reports to file. If the intention is to declare ' +
      'nothing to report for this period, choose "Nil return".',
    );
  }

  // Every DocRefId in a message must be distinct; a collision invalidates the
  // whole submission.
  const refs = planned.map((p) => p.docRefId);
  if (new Set(refs).size !== refs.length) {
    problems.push('Internal error: duplicate DocRefId generated. Do not submit this file.');
  }

  const corrs = planned.map((p) => p.corrDocRefId).filter(Boolean);
  if (new Set(corrs).size !== corrs.length) {
    problems.push(
      'Two records in this correction reference the same original record. ' +
      'Each record may be corrected only once per message.',
    );
  }

  return problems;
}

/** How a filing should be described back to the filer once generated. */
export function describeFiling(mode, counts) {
  switch (mode) {
    case FilingMode.Correction:
      return `${counts} corrected ${counts === 1 ? 'record' : 'records'}`;
    case FilingMode.Void:
      return `${counts} voided ${counts === 1 ? 'record' : 'records'}`;
    case FilingMode.Nil:
      return 'Nil return — nothing to report';
    case FilingMode.New:
    default:
      return `${counts} account ${counts === 1 ? 'report' : 'reports'}`;
  }
}
