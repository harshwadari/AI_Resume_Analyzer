# Authentication operations and verification

## Workspace account deletion

The workspace header now offers Delete account instead of Link Google. The
confirmation dialog requires typing DELETE and explains permanent removal.
POST /api/auth/delete-account uses the existing cookie authentication, Origin/
CSRF protection and rate limiting. The target account comes only from the
authenticated session, never a client-provided user ID.

Deletion removes the user document (including credentials, Google identity,
OTP/reset metadata), all owned interview reports (including resume text), and
pending OAuth linking records in one transaction. Other accounts are untouched.
The response clears the cookie; deleted-user checks reject all existing sessions.
The frontend clears private cached state and returns to the landing page only
after success. Errors remain visible in the dialog so the operation can be retried.

Report persistence also checks and writes the owner inside a transaction so a
slow report generation cannot save personal data after account deletion.
Transactions require a replica set or sharded MongoDB deployment (Atlas supports
this); a standalone local mongod needs replica-set configuration. Test databases
use an isolated single-node replica set. No live user data is touched by tests.
Anonymous expiring rate-limit counters are not account records and retain their
existing TTL. Provider email records and external backups are outside this app's
database deletion. Google sign-in remains available; signing in again after
deletion creates a new account, not a recovery of the old reports.

Verification: 42 backend tests, 16 frontend tests, production build and focused
frontend lint passed after this change. No live account was deleted.

For the current September 20 audit, deployment settings, verification results,
and changed-file inventory, see [AUTH_AUDIT.md](AUTH_AUDIT.md). It supersedes the
historical transport/deployment notes below: production now supports first-party
Vercel proxy cookies, an explicit GOOGLE_CALLBACK_URL, and optional Brevo HTTPS
authentication email. No new changes have been deployed during this audit.

## Local startup correction (2026-09-13)

PrepWise now uses frontend http://localhost:5173 and backend
http://localhost:3001. Port 3000 was serving a different local project (Parkly).
Local PORT, BACKEND_URL and VITE_API_URL were aligned; Vite uses strictPort on
5173 so it cannot silently move to a port that differs from FRONTEND_URL.
Google must authorize http://localhost:3001/api/auth/google/callback.
The user confirmed that this exact callback is already authorized in Google
Console. The backend's 302 redirect to accounts.google.com includes that URL
and OAuth state; a full interactive Google sign-in was not performed.

The system DNS resolver refused the MongoDB SRV query. The old repository had
an explicit resolver override; removing it broke this machine's connection.
MONGO_DNS_SERVERS is now an optional comma-separated resolver setting, configured
locally to working resolvers. Without it, system DNS is preserved. The read-only
live preflight completed with zero duplicate email, username and Google ID groups,
and backend startup successfully connected and initialized required indexes.

Live Gmail SMTP verification returned EAUTH without sending a message. Update
EMAIL_USER/EMAIL_PASS locally with the correct Gmail account and app password,
then restart the backend. Never paste the app password into chat or commit it.
Brevo remains optional; it is not a fallback for invalid Gmail credentials.

The interview list query now chains MongoDB sort/select before awaiting results;
the regression test also checks that another account receives no private reports.
After this correction, 34 backend tests and 9 frontend tests passed, and the
frontend production build succeeded. Live health returned 200, get-me without
a cookie returned 401, and CORS allowed the configured frontend origin.

## Architecture

Registration rejects an existing normalized email or exact username with HTTP
409 and a clear "username or email already exists" message. This applies to
verified and pending accounts alike and does not issue another OTP. Unique-index
race conflicts return the same error. New accounts alone proceed to verification;
pending users can sign in with their existing password to resume verification.
This intentionally exposes duplicate-account availability as requested by the
product's registration UX; login and password-recovery responses remain unchanged.

React pages call the shared Axios client with credentials and an X-Requested-With
header. Express enforces the configured Origin for unsafe API requests, applies
MongoDB-backed rate limits and Zod validation, and dispatches auth controllers.
The existing Mongoose User model and bcrypt credentials remain in place.

Registration uses a six-digit registration OTP, a keyed SHA-256 hash in MongoDB,
a five-minute expiry, five attempts, and a 60-second resend cooldown. Successful
verification atomically clears the challenge and verifies the account. SMTP
failure preserves the pending account and invalidates the undelivered challenge.

Forgot password uses a separate 32-byte random token, SHA-256 storage, and a
15-minute reset link. Reset atomically updates the bcrypt password, consumes the
token and increments tokenVersion. Google-only accounts receive a sign-in
reminder; accounts with both credentials can reset their existing password.
Both flows use the existing Nodemailer Gmail transport. Brevo is not required
and is not currently selected by the email service.

Password and Google authentication issue the same one-day httpOnly JWT cookie.
Middleware verifies algorithm, issuer, audience, expiry and current User version,
and rejects deleted/unverified users. Logout increments the version and clears
the cookie: it signs out all sessions for that account. Legacy JWTs are rejected.
Authentication and private API responses use Cache-Control: no-store.

The legacy authProvider field remains metadata. The independent password and
googleId fields identify available credentials. Google ID has a partial unique
index, while normalized email and username retain unique indexes. Existing
Google identities are looked up by ID even if their provider email changes;
this does not silently change the application's recovery email.

Google linking requires verified provider email. A verified local account with
the same authoritative Gmail/Workspace email can be linked while preserving its
password. Other same-email Google accounts require the /link-google page and
recent password confirmation. Unverified local accounts and conflicting Google
identities are rejected. No accounts are merged or deleted automatically.
OAuth state is random, browser-bound, hashed in MongoDB, expires after five
minutes, and is consumed once before the authorization code is exchanged.

## Configuration (never commit secret values)

Backend requires MONGO_URI and a randomly generated JWT_SECRET of at least 32
bytes. A length check cannot prove randomness. Google credentials must be
configured as a pair. EMAIL_USER and EMAIL_PASS configure the existing Gmail
SMTP transport; use the account's app password. BREVO_API_KEY, BREVO_FROM_EMAIL
and BREVO_FROM_NAME remain optional and unused by this transport.

FRONTEND_URL and BACKEND_URL must be HTTP(S) origins without paths or query
strings. Production requires explicitly configured HTTPS origins. Frontend
VITE_API_URL must equal the public backend origin and requires a rebuild when
changed. Register BACKEND_URL + /api/auth/google/callback as the exact authorized
redirect URI in Google Console. No credentials belong in VITE variables.

Cookies are host-only with path /. Production sets Secure; httpOnly is always
enabled. COOKIE_SAME_SITE accepts none, lax or strict; defaults are none in
production and lax in development. The OAuth browser cookie uses Lax for Google's
top-level callback. Cookie deletion uses matching scope. CSRF protection still
requires the configured Origin and X-Requested-With: XMLHttpRequest on POSTs.

Cross-site frontend/backend hosting can fail when browsers block third-party
cookies despite SameSite=None. Prefer HTTPS subdomains on the same registrable
domain, or a correctly configured same-origin reverse proxy. Verify the chosen
deployment in actual target browsers. Do not restore JWT-in-URL/localStorage
fallbacks. The frontend host must serve SPA routes such as /reset-password/:token.
Configure frontend/proxy Referrer-Policy: no-referrer and redact reset-link paths,
OAuth callback queries, Cookie headers and auth POST bodies from infrastructure
access logs/analytics. Application logs do not print these credentials.

TRUST_PROXY_HOPS defaults to zero. Configure it only to match trusted deployment
paths; restrict direct backend access and ensure proxies replace forwarded IP
headers. An incorrect hop count can make IP limits inaccurate or spoofable.

## Existing database rollout

Back up the database and inspect conflicting identities before deployment.
From Backend, the following command is read-only and prints duplicate counts,
not account identifiers or credentials:

```sh
node scripts/auth-migration.js
```

After reviewing the preflight, apply the additive compatibility migration:

```sh
node scripts/auth-migration.js --apply
```

The apply command creates identity/TTL indexes, initializes missing tokenVersion,
invalidates legacy plaintext OTPs, and schedules obsolete blacklist entries for
TTL cleanup. It never merges or deletes User documents. Resolve duplicate groups
manually after proving account ownership; do not blindly remove accounts.
The read-only preflight was subsequently run during the startup repair above;
the --apply compatibility migration has not been run against the live database.
Startup waits for MongoDB and index creation before listening, and fails closed
on configuration or index failures. MongoDB TTL deletion is asynchronous; auth
queries enforce expiry independently. Old users must sign in again; pending
registrations need a fresh OTP. Coordinate backend and frontend rollout because
Bearer authentication, /set-token and GET logout were removed.

## Local automated checks

```sh
# Backend directory
npm test

# Frontend directory
npm test
npm run build
npm run lint
```

Backend tests use Node's test runner and a temporary MongoDB instance with
synthetic users, HTTP requests, concurrency tests and mocked email delivery.
The first mongodb-memory-server run downloads a MongoDB binary. Frontend tests
use Vitest/jsdom and mocked API responses. Nodemailer templates are compiled
through its stream transport without sending mail. Startup ordering is tested
with mocks. Tests never use the application's live MongoDB or email credentials.

The original lockfiles are ignored by repository policy. Local dependency
installs can update them, but they are not included in Git changes. For repeatable
CI/deployments, review and adopt tracked lockfiles separately. A stale local lock
can make npm audit results differ from the installed tree; use
`npm audit --omit=dev --package-lock=false` when checking the installed tree.

## Required live smoke checks before production

1. Run the database preflight and approved migration in the target environment.
2. Register a controlled test account, receive an actual email, verify OTP,
   refresh the page and confirm the cookie restores authentication.
3. Exercise real Google consent: new account, repeat login, same-email verified
   local account, and explicit linking for a non-authoritative email. Check no
   JWT appears in the URL or browser storage and invalid state is rejected.
4. Receive a real reset link; reset once; verify an older cookie fails from a
   second browser. Check a Google-only account receives its sign-in reminder.
5. Log out and switch accounts; confirm no prior private report remains. Repeat
   in target browsers with their normal privacy settings and across tabs.
6. Check production HTTPS, CORS, proxy IP handling, cookie flags and SMTP delivery.

## Known limits outside these checks

Live Google token exchange, SMTP delivery and production browser cookie behavior
were not verified. Generic registration/recovery responses do not equalize
database/hash/SMTP timing; an observer may infer account eligibility from latency.
A durable email queue with uniform request handling is a future improvement.
Fixed-window limits can allow boundary bursts and targeted account throttling;
monitor before tuning. There is no per-device session management; logout revokes
all account sessions.

Existing unrelated frontend lint findings remain in the interview accordion
effect and theme context export. The interview list query failure was repaired
during the subsequent backend startup investigation.
No interview-generation/RAG logic was rewritten as part of this auth task.

## Changed file inventory

Paths below are relative to the repository root. Generated build output and ignored local lockfiles are not tracked changes.

| File | Change and purpose |
| --- | --- |
| `Backend/package.json` | Executable auth tests, MongoDB test dependency and patched Nodemailer. |
| `Backend/server.js` | Validate configuration, connect and enforce identity indexes before listening. |
| `Backend/src/Routes/auth.routes.js` | Rate limits, state-checked OAuth, explicit linking and POST logout; remove token import. |
| `Backend/src/app.js` | Exact credentialed CORS, CSRF checks, private cache policy and safe errors. |
| `Backend/src/config/database.js` | Await database connection and propagate startup failure safely. |
| `Backend/src/config/passport.config.js` | Delegate provider identity resolution without Passport sessions. |
| `Backend/src/controllers/auth.controller.js` | Credential-independent login/recovery, cookie-only JWTs, atomic reset and session revocation. |
| `Backend/src/middlewares/auth.middleware.js` | Verify cookie JWT and current verified account/version; minimize request user fields. |
| `Backend/src/models/blacklist.model.js` | TTL cleanup for obsolete blacklist records. |
| `Backend/src/models/user.model.js` | Independent credentials, unique Google ID, hashed OTP metadata and session version. |
| `Backend/src/services/email.service.js` | Reuse Gmail transport with bounded timeouts and sanitized logging. |
| `Backend/src/validations/auth.validations.js` | Password byte bounds, reset token shape and reauthentication validation. |
| `Frontend/package.json` | Add Vitest/jsdom and a test command. |
| `Frontend/src/App.jsx` | Mount private state under the current account identity. |
| `Frontend/src/app.routes.jsx` | Explicit Google link route and accessible recovery routes. |
| `Frontend/src/components/layout/WorkspaceHeader.jsx` | Link Google action and honest logout failure navigation. |
| `Frontend/src/features/auth/auth.context.jsx` | Cookie bootstrap, stale-request guards, 401 handling and cross-tab/focus refresh. |
| `Frontend/src/features/auth/hooks/useAuth.js` | Cookie-only actions and reliable logout state cleanup. |
| `Frontend/src/features/auth/pages/ForgotPassword.jsx` | Generic recovery instructions including Google-only accounts. |
| `Frontend/src/features/auth/pages/Login.jsx` | OAuth errors and logout failure messages. |
| `Frontend/src/features/auth/pages/ResetPassword.jsx` | Clear current auth state after successful password reset. |
| `Frontend/src/features/auth/pages/VerifyOtp.jsx` | Accurate generic verification and recovery guidance. |
| `Frontend/src/features/interview/hooks/useInterview.js` | Use isolated context and avoid logging raw API errors. |
| `Frontend/src/features/interview/interview.context.jsx` | Separate context export for safe account-keyed state. |
| `Frontend/src/features/interview/pages/Home.jsx` | Use safe error UI without raw API error logging. |
| `Frontend/src/features/interview/pages/Interview.jsx` | Never render a cached report for a different report URL. |
| `Frontend/src/features/interview/services/interview.api.js` | Use shared credentialed client without Bearer storage. |
| `Frontend/src/services/auth.api.js` | Unified cookie requests and OAuth navigation without token import. |
| `AUTHENTICATION.md` | Architecture, safe migration and deployment verification instructions. |
| `Backend/scripts/auth-migration.js` | Read-only identity preflight and optional additive compatibility migration. |
| `Backend/src/config/auth-indexes.js` | Create identity and expiring state/rate indexes without deleting accounts. |
| `Backend/src/config/auth.config.js` | Validate origins/secrets/proxy settings; centralize cookie scope. |
| `Backend/src/middlewares/csrf.middleware.js` | Enforce Origin and custom header on unsafe API requests. |
| `Backend/src/middlewares/link.middleware.js` | Require recent password proof before explicit linking. |
| `Backend/src/middlewares/oauth.middleware.js` | Create and consume browser-bound expiring OAuth state. |
| `Backend/src/middlewares/rate.middleware.js` | Atomic MongoDB limits keyed by hashed account/IP identifiers. |
| `Backend/src/models/authRate.model.js` | Shared request counters with TTL cleanup. |
| `Backend/src/models/oauthState.model.js` | Hashed one-time OAuth transactions with TTL cleanup. |
| `Backend/src/services/google-auth.service.js` | Stable provider-ID lookup and safe same-account linking. |
| `Backend/src/services/verification.service.js` | Hashed OTP issuance, cooldowns, bounded attempts and atomic consumption. |
| `Backend/src/utils/securityLog.js` | Allowlisted error metadata without credentials. |
| `Backend/test/cookie-csrf.test.js` | Backend authentication regression coverage: cookie-csrf.test.js |
| `Backend/test/database.test.js` | Backend authentication regression coverage: database.test.js |
| `Backend/test/email.test.js` | Backend authentication regression coverage: email.test.js |
| `Backend/test/google.test.js` | Backend authentication regression coverage: google.test.js |
| `Backend/test/helpers.js` | Backend authentication regression coverage: helpers.js |
| `Backend/test/login.test.js` | Backend authentication regression coverage: login.test.js |
| `Backend/test/logout.test.js` | Backend authentication regression coverage: logout.test.js |
| `Backend/test/middleware.test.js` | Backend authentication regression coverage: middleware.test.js |
| `Backend/test/model.test.js` | Backend authentication regression coverage: model.test.js |
| `Backend/test/oauth-state.test.js` | Backend authentication regression coverage: oauth-state.test.js |
| `Backend/test/otp.test.js` | Backend authentication regression coverage: otp.test.js |
| `Backend/test/rate.test.js` | Backend authentication regression coverage: rate.test.js |
| `Backend/test/registration.test.js` | Backend authentication regression coverage: registration.test.js |
| `Backend/test/reset.test.js` | Backend authentication regression coverage: reset.test.js |
| `Backend/test/startup.test.js` | Backend authentication regression coverage: startup.test.js |
| `Frontend/src/features/auth/auth.state.js` | Separate auth context declaration. |
| `Frontend/src/features/auth/components/PrivateStateBoundary.jsx` | Reset private cached state when account identity changes. |
| `Frontend/src/features/auth/pages/LinkGoogle.jsx` | Password-confirmed same-email Google linking UI. |
| `Frontend/src/features/interview/interview.state.js` | Separate interview context declaration. |
| `Frontend/src/services/http.js` | Credentials, CSRF header, current-session 401 handling and stale-response cancellation. |
| `Frontend/src/services/session.js` | Shared session epoch for pending API requests. |
| `Frontend/test/auth.test.jsx` | Frontend authentication state/API regression coverage. |
| `Frontend/test/http.test.js` | Frontend authentication state/API regression coverage. |
| `Frontend/vitest.config.js` | Browser-like React authentication test environment. |
