#!/usr/bin/env node
/**
 * Grant or revoke the `admin` custom claim.
 *
 * Admin used to be a `role` field on the user's own Firestore document, which
 * the user could write. Anyone could make themselves an admin and then reset
 * any account's quota. Custom claims live in the ID token, are signed by
 * Firebase, and can only be set with the Admin SDK -- i.e. from here.
 *
 *   node functions/scripts/set-admin-claim.js someone@example.com
 *   node functions/scripts/set-admin-claim.js someone@example.com --revoke
 *
 * Requires application default credentials for the project, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * or `gcloud auth application-default login`.
 *
 * The holder must sign out and back in (or the client must call
 * getIdToken(true)) before the new claim appears in their token.
 */
const admin = require('firebase-admin');

async function main() {
  const [email, ...flags] = process.argv.slice(2);
  const revoke = flags.includes('--revoke');

  if (!email) {
    console.error('Usage: set-admin-claim.js <email> [--revoke]');
    process.exit(2);
  }

  admin.initializeApp();

  const user = await admin.auth().getUserByEmail(email);

  // Merge rather than replace: overwriting the claims object would silently
  // drop any other claim the account carries.
  const claims = { ...(user.customClaims || {}) };
  if (revoke) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }

  await admin.auth().setCustomUserClaims(user.uid, claims);

  console.log(
    `${revoke ? 'Revoked' : 'Granted'} admin for ${email} (${user.uid}).`,
  );
  console.log('They must re-authenticate before the change takes effect.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
