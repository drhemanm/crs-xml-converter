# Firestore security-rules tests

These run the real rules against the Firestore emulator. They exist because
security rules are not the kind of thing to verify by reading: the previous
audit-trail rules looked plausible and denied every write in production, and
the previous `users/{uid}` rule looked like ownership scoping while letting any
account issue itself an enterprise plan.

```
cd firestore-tests
npm install
npm test          # needs a JDK on PATH for the emulator
```

`firebase.json` points at `../firestore.rules`, so there is one copy of the
rules and the tests exercise the file that actually deploys.

## What is covered

- **C1** — a user cannot change `plan`, `conversionsLimit`, `subscriptionStatus`
  or `role`, on create or update, and cannot register another person's email.
- **C3** — `role: 'admin'` is unwritable; admin is a custom claim.
- **C4 (partial)** — `conversionsUsed` may only advance by one and never past
  the limit. A client can still decline to increment; closing that needs
  server-side counting.
- **H1** — audit entries are create-only, attributable to the caller, stamped
  with the server clock, and unreadable by anyone else.
- No catch-all: an arbitrary collection name is not writable.

Diagnostics of the form `evaluation error at L98 for 'update'` in the emulator
output accompany intentional denials. Firestore evaluates both sides of `&&`
when collecting diagnostics, and an evaluation error always denies, so these
are fail-safe. Every legitimate operation in the suite succeeds.
