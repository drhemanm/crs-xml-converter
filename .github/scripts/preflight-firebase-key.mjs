/**
 * Diagnose a Firebase service-account key before anything is attempted with it.
 *
 * This exists because every tool in the chain reports credential problems
 * badly. firebase-tools says "Failed to authenticate, have you run firebase
 * login?" for a malformed key, a revoked key, a mismatched client_email and a
 * deleted service account alike. An earlier version of this workflow reported
 * a key that would not parse as "could not determine the project", pointing at
 * a repository variable that had nothing to do with it.
 *
 * Each failure here names its own cause and says what to do about it.
 *
 * Lives as a file rather than inline YAML so it can be run and tested directly:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=key.json node .github/scripts/preflight-firebase-key.mjs
 *
 * No dependencies: node's crypto signs the JWT and fetch asks Google.
 */
import { createSign } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';

const fail = (...lines) => {
  for (const line of lines) console.error(line);
  process.exit(1);
};

const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!path) fail('GOOGLE_APPLICATION_CREDENTIALS is not set.');

const raw = readFileSync(path, 'utf8');

let key;
try {
  key = JSON.parse(raw);
} catch (e) {
  const lines = [`The secret is not valid JSON: ${e.message}`, ''];

  // By far the most common cause, so name it rather than leaving the reader to
  // work out what "unexpected token" means. In the downloaded file the private
  // key is one long line containing the two characters backslash-n; an actual
  // newline inside a JSON string is invalid.
  const fromKey = raw.slice(raw.indexOf('private_key'));
  if (raw.includes('private_key') && /[^\\]\n/.test(fromKey)) {
    lines.push(
      'The private_key appears to contain real line breaks.',
      'In the downloaded file those are the two characters backslash-n inside one long line.',
      'JSON does not allow an actual newline inside a string, so the file no longer parses.',
      '',
      'Do not retype or reformat the key: open the .json file, select all, copy, paste.',
      '',
    );
  }

  lines.push(
    `For reference, the secret is ${raw.length} characters and starts with ${JSON.stringify(raw.slice(0, 40))}`,
  );
  fail(...lines);
}

for (const field of ['client_email', 'private_key', 'project_id']) {
  if (!key[field]) {
    fail(
      `The key is missing "${field}".`,
      'Copy the whole downloaded .json file into the secret, not part of it.',
    );
  }
}

if (/XXXXX|PASTE_FROM/.test(`${key.client_email}${key.private_key_id || ''}${key.client_id || ''}`)) {
  fail(
    'The key still contains placeholder text (XXXXX or PASTE_FROM_YOUR_FILE).',
    'Copy the whole downloaded .json file rather than filling in a template.',
  );
}

const project = process.env.PROJECT_VAR || key.project_id;

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = [
  b64({ alg: 'RS256', typ: 'JWT' }),
  b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 300,
    iat: now,
  }),
].join('.');

let signature;
try {
  signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
} catch (e) {
  fail(
    `The private_key could not be used to sign: ${e.message}`,
    'It is truncated, or its line breaks were altered. Paste the file unmodified.',
  );
}

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${unsigned}.${signature}`,
  }),
});
const body = await response.json();

if (response.ok) {
  console.log(`Authenticated as ${key.client_email}`);
  console.log(`Deploying to project ${project}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `project=${project}\n`);
  }
  process.exit(0);
}

const detail = [`Google rejected the credentials: ${body.error} — ${body.error_description || '(no detail)'}`];

if (body.error === 'invalid_grant') {
  detail.push(
    '',
    'The signature did not match the account. The private_key belongs to a different',
    'key than the client_email beside it — which is what happens when the file is',
    'assembled by hand. Download a fresh key and paste the entire file.',
  );
}
if (body.error === 'invalid_client') {
  detail.push('', 'The service account in client_email does not exist, or its key has been deleted.');
}

fail(...detail);
