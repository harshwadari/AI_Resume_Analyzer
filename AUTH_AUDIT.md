# Authentication audit — September 20, 2026

Changes are local and have not been pushed or deployed. This report supersedes
the deployment and email-transport notes in the older AUTHENTICATION.md.

## Findings and fixes

1. Login and OTP verification immediately navigated to `/workspace`. `GuestOnly`
   also redirected as soon as context received a user, so a page-only delay would
   not work. The guard now shows a 900 ms success screen with a small animated
   green check before redirecting. Reduced-motion preferences disable drawing.
2. Login/OTP trusted the returned user without checking whether the browser
   retained the cookie. They now call `/get-me` before setting authenticated
   state. A rejected cookie produces an actionable session error, not false success.
3. Google authorization had no `prompt`. An existing Google session and prior
   consent can therefore skip account selection. The live redirect confirmed
   the missing parameter; a browser without a Google session reached Google's
   sign-in page. This supports the session-reuse explanation, but the original
   user's exact localhost browser state was not reproduced. The explicit Google
   sign-in/link buttons now request `select_account`, preserving state validation.
   An already authenticated PrepWise user is still redirected by `GuestOnly`;
   log out first when testing a fresh login.
4. The deployed bundle calls the correct Render backend directly, but Vercel and
   Render are unrelated sites. Correct `SameSite=None; Secure` flags cannot
   guarantee cookies when third-party cookies are blocked. Added a Vercel `/api`
   reverse proxy, production same-origin default, and an explicit validated
   `GOOGLE_CALLBACK_URL`. API and OAuth must both use the proxy to share cookies.
   Browser cookie blocking was not directly reproduced with a real account.
5. Missing frontend configuration silently fell back to localhost even in
   production. Production now defaults to same-origin; malformed origins, URL
   paths, and HTTP production origins fail the build. Auth and private API
   clients share this resolution. Local `.env` intentionally keeps port 3001.
6. Failed OTP delivery was caught and returned as ordinary success. The service
   now invalidates the undelivered challenge and returns a sanitized 503.
   Registration explains that the pending account exists and sign-in can resume
   verification; unverified login still opens the OTP page for retry/resend.
7. Auth email only supported Gmail SMTP. Render's free tier blocks SMTP ports;
   the deployment plan is unknown, so this is a conditional deployment cause,
   not a proven outage. Added optional Brevo HTTPS for auth email without new
   dependencies. Existing contact email remains on its existing SMTP transport.
8. Temporary `/get-me` failures on window focus cleared a known user. Only a
   definitive 401 now clears that session; initial protected access still waits
   for the server to confirm authentication.
9. Auth pages assumed localStorage was available; failures could interrupt
   verification navigation. Pending-email storage is now optional, with route
   state retained. README's obsolete backend port 3000 was corrected to 3001.

Duplicate registration was already correct: normalized email/username checks
plus unique indexes return 409 and do not overwrite credentials or resend OTP.
No schema, password hashing, identity-linking rules, token lifetime, business
logic, interview features, or dependencies were changed.

## Architecture reviewed

React auth pages → credentialed Axios with `X-Requested-With` → Express exact
Origin CORS and CSRF checks → rate limits/Zod → existing auth controllers.
Registration stores a pending user and a keyed six-digit OTP hash. Verification
enforces five-minute expiry, cooldown, bounded attempts, and atomic consumption.
Password, OTP and Google issue one-day host-only httpOnly JWT cookies. Middleware
checks signature, issuer, audience, expiry, verified user and tokenVersion.
Logout revokes the account's sessions and clears matching cookie scope.

Passport's Google code flow retains hashed, expiring, one-use browser-bound
OAuth state and existing same-account linking rules. No tokens are placed in
URLs or browser storage. Password recovery retains hashed reset tokens and
revokes existing sessions. Generic recovery replies still avoid disclosing
account existence; delivery failures are logged without provider bodies.

The audit covered entry points, routes, middleware, models/indexes, auth services,
pages/guards/context, shared/private API clients, deployment files, environment
variable names, tests, and authentication dependencies in other features.
No backend deployment manifest is present. Host dashboard settings and Google
Console configuration cannot be established from repository files.

## Required configuration

Local `.env` files contain all currently used credentials. Values were not
printed. SMTP credential verification succeeded without sending mail. No new
credentials were generated or existing secrets edited.

| Setting | Local development | Vercel / backend production |
| --- | --- | --- |
| Frontend `VITE_API_URL` | `http://localhost:3001` | Set `/` in Vercel Production and rebuild |
| Backend `NODE_ENV` | `development` | `production` |
| Backend `PORT` | `3001` | Platform-provided port |
| Backend `FRONTEND_URL` | `http://localhost:5173` | `https://ai-resume-analyzer-gray-ten.vercel.app` |
| Backend `BACKEND_URL` | `http://localhost:3001` | `https://ai-resume-analyzer-2xdy.onrender.com` |
| Backend `GOOGLE_CALLBACK_URL` | Unset or `http://localhost:3001/api/auth/google/callback` | `https://ai-resume-analyzer-gray-ten.vercel.app/api/auth/google/callback` |
| Backend `COOKIE_SAME_SITE` | `lax` | `lax` with the first-party proxy |
| Backend `MONGO_URI` | Existing database connection | Verify production database connection and required indexes |
| Backend `JWT_SECRET` | Existing random secret, at least 32 bytes | Stable random secret shared by backend instances |
| Backend `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Matching web OAuth client pair | Matching production web OAuth client pair |
| Backend `EMAIL_PROVIDER` | Unset or `smtp` | `brevo` if SMTP is blocked; otherwise `smtp` |
| Backend `EMAIL_USER`, `EMAIL_PASS` | Gmail address and app password | Required for SMTP auth mail; existing contact mail still uses these |
| Backend `BREVO_API_KEY`, `BREVO_FROM_EMAIL` | Not needed for SMTP | Required when `EMAIL_PROVIDER=brevo`; sender must be verified |
| Backend `BREVO_FROM_NAME` | Optional | Optional; defaults to `PrepWise AI` |
| Backend `TRUST_PROXY_HOPS` | `0` | Match the actual trusted proxy topology; do not guess a hop count |
| Backend `MONGO_DNS_SERVERS` | Existing optional resolver override | Only if platform DNS requires it; otherwise omit |

No secret belongs in a `VITE_` variable. No cookie Domain setting is needed:
cookies remain host-only. The repository cannot confirm deployed secrets, SMTP
reachability, Render plan, proxy trust settings, or Brevo sender verification.
Preview domains need their own matching backend configuration; wildcard CORS
was intentionally not introduced.

### Coordinated rollout

1. In Google Console, add the exact authorized redirect URI
   `https://ai-resume-analyzer-gray-ten.vercel.app/api/auth/google/callback`.
   Retain `http://localhost:3001/api/auth/google/callback` for local development.
   Keep the old Render callback during rollout until the new flow is verified.
2. This is server-side Passport OAuth, not a Google JavaScript SDK: authorized
   redirect URIs are the critical setting. If JavaScript origins are configured,
   use `http://localhost:5173` and the exact production frontend origin, no paths.
3. Deploy these backend changes and the production environment values above.
   Deploy the frontend with `VITE_API_URL=/` and the new `vercel.json` rewrite.
   Coordinate the releases: a direct-backend start with a frontend callback, or
   the reverse, cannot share the host-only OAuth browser cookie.
4. Keep the frontend root directory `Frontend`, build command `npm run build`,
   and output directory `dist`. The `/api/:path*` rewrite must precede the SPA
   fallback. It deliberately proxies private APIs too, because they use the same
   authentication cookie. The Render destination is the verified public backend;
   change it if that service URL changes.
5. Backend root is `Backend`, start command `npm start`. Startup already waits
   for MongoDB and required indexes. No database migration was performed here.
6. Sign in again after rollout; old Render-host cookies are not copied to Vercel.
   Do not log callback query strings, reset URLs, request bodies or cookies in
   proxy/provider logs. Auth responses and the proxy route use `no-store`.

For a local production build using the proxy configuration, in PowerShell:
`$env:VITE_API_URL='/'; npm run build`. Vite's local preview does not implement
Vercel rewrites; use `npm run dev` with the local backend for local app testing.

## Verification results

- Baseline: 35 backend tests and 10 frontend tests passed.
- Updated suites: 40 backend tests and 15 frontend tests passed, including real
  HTTP and temporary MongoDB integration tests. Emails and provider exchanges
  use synthetic data/mocks. Production cookie attributes, first-party Origin,
  login/get-me/logout, and callback validation are covered locally.
- Production build passed with `VITE_API_URL=/`.
- A production build with `VITE_API_URL=http://localhost:3001` failed as expected
  with the configuration error. Focused lint for auth files, shared services,
  changed frontend tests and Vite configuration passed.
- Full lint still has the pre-existing Interview.jsx effect/dependency findings
  and theme.context.jsx fast-refresh export error. No unrelated fixes were made.
- Live deployment: frontend returned 200 and its bundle used the correct Render
  origin; `/health` returned 200; unauthenticated `/get-me` returned 401 with exact
  credentialed CORS; login OPTIONS returned 204; Google initiation returned 302
  to Google with the expected old Render callback, state and secure Lax cookie.
- Live browser: invalid synthetic credentials displayed `Invalid email or
  password`; Google button reached Google's sign-in page without callback mismatch.
- Local SMTP verification accepted credentials; no real message was sent.
- Not verified end-to-end: real OTP delivery, real new-user registration, real
  Google token exchange/account selection, signed-in persistence in actual target
  browsers, logout with a real account, or the new Vercel proxy after deployment.

## Manual acceptance test (repeat locally and after production rollout)

1. Start local backend/frontend (`npm start` / `npm run dev`) or open production.
   In browser Network, confirm requests use local port 3001 in development and
   the Vercel `/api` origin in production. Confirm auth responses are not cached.
2. Register a unique username and an email you control. Receive the actual OTP;
   retry that email with another username and expect a clear 409/sign-in message.
   Also test a duplicate username without changing the original account.
3. Enter an incorrect OTP, then the correct one. Verify the small green check
   appears for roughly 0.9 seconds before `/workspace`. Reusing a consumed OTP
   must fail. For a separate pending account, check expiry after five minutes,
   resend after 60 seconds, old-code rejection, and five-attempt exhaustion.
4. Refresh the workspace. `/get-me` must return 200 with the same user. Production
   cookie should be on the Vercel host, HttpOnly, Secure, Path=/, SameSite=Lax,
   with no Domain attribute. No JWT should appear in localStorage or URLs.
5. Log out, refresh, and open `/workspace`; it must return to login. Sign in with
   a wrong password, then the correct password. Repeat animation and refresh checks.
6. Log out, click Google with an existing Google session, and confirm account
   selection appears. Finish with a controlled account, refresh, log out, and
   repeat in a private window. Cancel Google and confirm an actionable login error.
   Reload a used callback to confirm state cannot be replayed.
7. For a verified local account, test Google with the same trusted email and
   confirm password login still works. Test explicit linking from the workspace
   with recent password confirmation. Google cannot take over a pending account.
8. With a pending local account, sign in to resume verification. Simulate an email
   provider failure in a test environment: expect a clear delivery error, no valid
   undelivered OTP, no duplicate account, and working resend after cooldown.
9. Test password recovery with a controlled account; consume the reset link once,
   verify the old password/session fails and the new password works. Google-only
   accounts should receive the existing sign-in reminder.
10. Repeat production checks in browsers that block third-party cookies, across
    tabs, and after refresh. Test temporary network loss while switching focus:
    existing local session state should remain, while protected API authorization
    continues to be enforced by the backend.

## Files changed in this audit

| Files (relative to repository root) | Change |
| --- | --- |
| `Backend/src/config/auth.config.js`, `passport.config.js` | Validated optional frontend-proxy OAuth callback. |
| `Backend/src/middlewares/oauth.middleware.js` | Request account selection while retaining state checks. |
| `Backend/src/config/email.config.js` | Provider-aware auth email configuration checks. |
| `Backend/src/services/email.service.js` | Optional Brevo HTTPS auth email; preserve SMTP/contact behavior. |
| `Backend/src/services/verification.service.js` | Report delivery failure after clearing undelivered challenge. |
| `Backend/src/controllers/auth.controller.js` | Provider-aware checks and pending-account email recovery responses. |
| `Frontend/src/services/api-base.js`, `http.js`, `auth.api.js` | Shared validated API origin, production same-origin default. |
| `Frontend/vite.config.js` | Reject invalid production API configuration during build. |
| `Frontend/vercel.json` | First-party API rewrite, no-store and no-referrer headers. |
| `Frontend/src/features/auth/auth.context.jsx` | Success state and resilience to temporary focus-refresh failures. |
| `Frontend/src/features/auth/hooks/useAuth.js` | Confirm cookie session before accepting login/OTP success. |
| `Frontend/src/features/auth/components/GuestOnly.jsx`, `AuthSuccess.jsx`, `auth-success.css` | Green check and delayed guarded redirect, reduced-motion support. |
| `Frontend/src/features/auth/pages/Login.jsx`, `Register.jsx`, `VerifyOtp.jsx` | Remove immediate success redirects; tolerate unavailable pending-email storage. |
| `Backend/test/cookie-csrf.test.js`, `database.test.js`, `email.test.js`, `helpers.js`, `oauth-state.test.js`, `otp.test.js`, `registration.test.js` | Callback, production cookie lifecycle, provider failure and OAuth prompt regressions. |
| `Frontend/test/auth.test.jsx`, `api-base.test.js` | Cookie confirmation, animation ordering, focus failures and configuration regressions. |
| `Backend/.env.example`, `Frontend/.env.example` | Secret-free setup templates. |
| `README.md`, `AUTHENTICATION.md`, `AUTH_AUDIT.md` | Correct local port; current findings, rollout and verification instructions. |

## Provider references

- [Google OAuth web-server flow and prompt](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Render free-service SMTP restrictions](https://render.com/docs/free)
- [Brevo transactional email API](https://developers.brevo.com/docs/send-a-transactional-email)
