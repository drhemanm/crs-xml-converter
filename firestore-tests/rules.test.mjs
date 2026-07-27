import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, increment } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'crs-rules-test',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8089 },
});

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('  PASS  ' + name); pass++; }
  catch (e) { console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n')[0]); fail++; }
};

// Contexts are created once: a Firestore instance rejects settings changes
// after its first use, so re-creating them mid-run throws.
const aliceDb = env.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
const bobDb = env.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
const adminDb = env.authenticatedContext('root', { email: 'root@example.com', admin: true }).firestore();
const anonDb = env.unauthenticatedContext().firestore();
const alice = () => aliceDb;
const bob = () => bobDb;
const admin = () => adminDb;
const anon = () => anonDb;

const freeDoc = (email = 'alice@example.com') => ({
  email, displayName: 'Alice', company: 'Acme',
  plan: 'free', conversionsUsed: 0, conversionsLimit: 3, subscriptionStatus: 'active',
  createdAt: serverTimestamp(), lastLogin: serverTimestamp(), provider: 'email',
  savedGIINs: [], preferences: { currency: 'USD' },
});

// Seeding goes through the ordinary client path rather than a rules-disabled
// context. That keeps one Firestore instance per identity (the SDK refuses
// settings changes after first use) and, more usefully, means the fixtures
// themselves prove the rules permit the sequence the real app performs.
const seed = async () => {
  await setDoc(doc(alice(), 'users/alice'), freeDoc());
  await setDoc(doc(alice(), 'audit_user_actions/e1'), {
    userId: 'alice', timestamp: serverTimestamp(), eventType: 'user_login',
  });
};

console.log('\nusers/{uid} — creation');
await env.clearFirestore();
await t('owner can create their own free-plan document', () => assertSucceeds(setDoc(doc(alice(), 'users/alice'), freeDoc())));
await env.clearFirestore();
await t('cannot create a document for another uid', () => assertFails(setDoc(doc(alice(), 'users/bob'), freeDoc('bob@example.com'))));
await t('cannot self-issue enterprise on create', () => assertFails(setDoc(doc(alice(), 'users/alice'), { ...freeDoc(), plan: 'enterprise', conversionsLimit: 1000000 })));
await t('cannot start with a used-count already reset high', () => assertFails(setDoc(doc(alice(), 'users/alice'), { ...freeDoc(), conversionsLimit: 999 })));
await t('cannot self-issue the admin role on create', () => assertFails(setDoc(doc(alice(), 'users/alice'), { ...freeDoc(), role: 'admin' })));
await t('cannot register somebody else\'s email', () => assertFails(setDoc(doc(alice(), 'users/alice'), freeDoc('victim@example.com'))));
await t('anonymous cannot create a user document', () => assertFails(setDoc(doc(anon(), 'users/alice'), freeDoc())));

console.log('\nusers/{uid} — the C1 attack');
await env.clearFirestore(); await seed();
await t('cannot self-upgrade plan (C1)', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { plan: 'enterprise' })));
await t('cannot raise conversionsLimit (C1)', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { conversionsLimit: 1000000 })));
await updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) });
await updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) });
await t('cannot reset conversionsUsed to 0 (C4)', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0 })));
await t('cannot decrement conversionsUsed at all', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 1 })));
await t('cannot grant themselves role=admin (C3)', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { role: 'admin' })));
await t('cannot change subscriptionStatus', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { subscriptionStatus: 'active', conversionsLimit: 99 })));
await t('cannot change their email', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { email: 'victim@example.com' })));
await t('cannot write an unknown field', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { isVip: true })));
await t('cannot delete their document directly', () => assertFails(deleteDoc(doc(alice(), 'users/alice'))));

console.log('\nusers/{uid} — legitimate use still works');
await env.clearFirestore(); await seed();
await t('can update lastLogin', () => assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { lastLogin: serverTimestamp(), lastLoginIP: 'masked_for_privacy' })));
await t('can update profile fields', () => assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { displayName: 'Alice B', company: 'Acme Ltd', preferences: { currency: 'EUR' }, savedGIINs: ['ABC123.00000.MU.480'] })));
await t('can increment conversionsUsed by one', () => assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) })));
await t('can read their own document', () => assertSucceeds(getDoc(doc(alice(), 'users/alice'))));
await t('cannot read another user\'s document', () => assertFails(getDoc(doc(bob(), 'users/alice'))));
await t('admin can read any user document', () => assertSucceeds(getDoc(doc(admin(), 'users/alice'))));

console.log('\nusers/{uid} — quota ceiling');
await env.clearFirestore();
await setDoc(doc(alice(), 'users/alice'), freeDoc());
// Spend the free allowance the way the app does, one conversion at a time.
for (let i = 0; i < 3; i++) await updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) });
await t('cannot increment past the limit', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) })));
await t('cannot jump the counter by more than one', () => assertFails(updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 2 })));

console.log('\naudit trail (H1)');
await env.clearFirestore(); await seed();
const goodEntry = { userId: 'alice', timestamp: serverTimestamp(), eventType: 'xml_conversion_started' };
await t('signed-in user can create their own audit entry', () => assertSucceeds(addDoc(collection(alice(), 'audit_user_actions'), goodEntry)));
await t('...and in the other audit collections', async () => {
  await assertSucceeds(addDoc(collection(alice(), 'audit_file_processing'), { ...goodEntry, timestamp: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(alice(), 'audit_xml_generation'), { ...goodEntry, timestamp: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(alice(), 'audit_data_access'), { ...goodEntry, timestamp: serverTimestamp() }));
});
await t('cannot forge an entry attributed to someone else', () => assertFails(addDoc(collection(alice(), 'audit_user_actions'), { ...goodEntry, userId: 'bob', timestamp: serverTimestamp() })));
await t('cannot back-date an audit entry', () => assertFails(addDoc(collection(alice(), 'audit_user_actions'), { userId: 'alice', timestamp: new Date('2020-01-01'), eventType: 'x' })));
await t('anonymous cannot write to the audit trail', () => assertFails(addDoc(collection(anon(), 'audit_user_actions'), { userId: 'anonymous', timestamp: serverTimestamp(), eventType: 'x' })));
await t('cannot modify an existing audit entry', () => assertFails(updateDoc(doc(alice(), 'audit_user_actions/e1'), { eventType: 'tampered' })));
await t('cannot delete an audit entry', () => assertFails(deleteDoc(doc(alice(), 'audit_user_actions/e1'))));
await t('can read their own audit entry', () => assertSucceeds(getDoc(doc(alice(), 'audit_user_actions/e1'))));
await t('cannot read another user\'s audit entry', () => assertFails(getDoc(doc(bob(), 'audit_user_actions/e1'))));
await t('client cannot write subscription audit events', () => assertFails(addDoc(collection(alice(), 'audit_subscription_events'), { userId: 'alice', timestamp: serverTimestamp() })));

console.log('\ndata subject requests');
await env.clearFirestore();
await t('can lodge a request about themselves', () => assertSucceeds(addDoc(collection(alice(), 'data_requests'), { userId: 'alice', status: 'received', submittedAt: serverTimestamp(), type: 'access' })));
await t('cannot lodge one as somebody else', () => assertFails(addDoc(collection(alice(), 'data_requests'), { userId: 'bob', status: 'received', submittedAt: serverTimestamp(), type: 'access' })));
await t('cannot mark their own request completed', () => assertFails(addDoc(collection(alice(), 'data_requests'), { userId: 'alice', status: 'completed', submittedAt: serverTimestamp(), type: 'access' })));
await t('anonymous cannot lodge a request', () => assertFails(addDoc(collection(anon(), 'data_requests'), { userId: 'alice', status: 'received', submittedAt: serverTimestamp() })));
// The exact payload DataRequestPortal sends, so the rules are checked against
// the shape the app actually writes rather than a convenient minimal one.
await t('accepts the payload the portal sends', () => assertSucceeds(addDoc(collection(alice(), 'data_requests'), {
  userId: 'alice', accountEmail: 'alice@example.com', contactEmail: 'alice@example.com',
  firstName: 'Alice', lastName: 'Smith', requestType: 'erasure',
  description: 'Please delete my account data.', urgency: 'normal',
  status: 'received', submittedAt: serverTimestamp(),
})));
await t('cannot back-date a request', () => assertFails(addDoc(collection(alice(), 'data_requests'), { userId: 'alice', status: 'received', submittedAt: new Date('2020-01-01'), requestType: 'access' })));

console.log('\nmonthly quota reset (no Cloud Functions, no billing)');
const period = (offsetMonths = 0) => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
};
const thisPeriod = () => period(0);
const lastPeriod = () => period(-1);

// Create with the period already recorded, then spend the allowance the way the
// app does. usagePeriod is unwritable except through a reset, so seeding it at
// create time is the only way to arrange a stale period.
const seedSpent = async (usagePeriod) => {
  await setDoc(doc(alice(), 'users/alice'), usagePeriod ? { ...freeDoc(), usagePeriod } : freeDoc());
  for (let i = 0; i < 3; i++) await updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) });
};

await env.clearFirestore();
await seedSpent(null);
await t('resets a spent quota when no period was ever recorded', () => assertSucceeds(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: thisPeriod() })));

await updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: increment(1) });
await t('cannot reset again in the same month', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: thisPeriod() })));

await t('cannot reset by claiming a future month', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: '2099-1' })));

await t('cannot reset by replaying last month', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: lastPeriod() })));

await t('cannot move the period on its own to unlock a reset later', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { usagePeriod: '2099-1' })));

await env.clearFirestore();
await seedSpent(lastPeriod());
await t('resets once the recorded period is stale', () => assertSucceeds(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: thisPeriod() })));

await env.clearFirestore();
await seedSpent(lastPeriod());
await t('cannot raise the limit while resetting', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0, usagePeriod: thisPeriod(), conversionsLimit: 999 })));

await t('cannot zero the counter without recording the period', () => assertFails(
  updateDoc(doc(alice(), 'users/alice'), { conversionsUsed: 0 })));

await t('ordinary profile writes still work alongside all this', () => assertSucceeds(
  updateDoc(doc(alice(), 'users/alice'), { displayName: 'Alice B' })));

console.log('\nthe filing ledger');
await env.clearFirestore();
const filing = () => ({
  userId: 'alice', country: 'MU', giin: 'ABC123.00000.MU.480',
  institutionName: 'Test Bank Ltd', taxYear: 2024, schemaVersion: '2.0',
  filingMode: 'new', messageRefId: 'MU2024MSG1', reportingFiDocRefId: 'MU2024FI1',
  recordCount: 2, createdAt: serverTimestamp(),
});
const filingRecord = () => ({
  userId: 'alice', accountKey: 'a'.repeat(64), docRefId: 'MU2024REC1',
  docTypeIndic: 'OECD1', corrDocRefId: null, sequence: 1, createdAt: serverTimestamp(),
});

await t('owner can record a filing', () => assertSucceeds(setDoc(doc(alice(), 'filings/f1'), filing())));
await t('...and its records', () => assertSucceeds(setDoc(doc(alice(), 'filings/f1/records/r1'), filingRecord())));
await t('can read their own filing back', () => assertSucceeds(getDoc(doc(alice(), 'filings/f1'))));
await t('can read their own filing records', () => assertSucceeds(getDoc(doc(alice(), 'filings/f1/records/r1'))));
await t('cannot read another user\'s filing', () => assertFails(getDoc(doc(bob(), 'filings/f1'))));
await t('cannot read another user\'s filing records', () => assertFails(getDoc(doc(bob(), 'filings/f1/records/r1'))));
await t('cannot file under another user id', () => assertFails(setDoc(doc(alice(), 'filings/f2'), { ...filing(), userId: 'bob' })));
await t('anonymous cannot record a filing', () => assertFails(setDoc(doc(anon(), 'filings/f3'), filing())));

// The ledger is what a correction references. Rewriting a DocRefId would make
// the next correction point at a record the authority has never seen.
await t('cannot rewrite a filing', () => assertFails(updateDoc(doc(alice(), 'filings/f1'), { messageRefId: 'tampered' })));
await t('cannot delete a filing', () => assertFails(deleteDoc(doc(alice(), 'filings/f1'))));
await t('cannot rewrite a filed record', () => assertFails(updateDoc(doc(alice(), 'filings/f1/records/r1'), { docRefId: 'tampered' })));
await t('cannot delete a filed record', () => assertFails(deleteDoc(doc(alice(), 'filings/f1/records/r1'))));
await t('cannot back-date a filing', () => assertFails(setDoc(doc(alice(), 'filings/f4'), { ...filing(), createdAt: new Date('2020-01-01') })));

// The whole privacy claim rests on customer data never reaching the server.
// hasOnly() means an extra field is refused, so it cannot arrive by accident.
await t('cannot smuggle an account number into a filing', () => assertFails(
  setDoc(doc(alice(), 'filings/f5'), { ...filing(), accountNumber: 'MU00112233' })));
await t('cannot smuggle customer data into a filing record', () => assertFails(
  setDoc(doc(alice(), 'filings/f1/records/r2'), { ...filingRecord(), holderName: 'Jean Dupont' })));
await t('cannot store an account number in place of the hash', () => assertFails(
  setDoc(doc(alice(), 'filings/f1/records/r3'), { ...filingRecord(), accountKey: 12345 })));

console.log('\nserver-only collections');
await env.clearFirestore();
await env.clearFirestore();
for (const c of ['paypal_events', 'subscription_history', 'payment_history', 'pending_subscriptions', 'system_events']) {
  await t(`client cannot write ${c}`, () => assertFails(addDoc(collection(alice(), c), { x: 1 })));
}
await t('no catch-all lets a client write an arbitrary collection', () => assertFails(addDoc(collection(alice(), 'whatever'), { x: 1 })));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
