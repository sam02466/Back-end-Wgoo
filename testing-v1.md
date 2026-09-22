WGOO GAMING BACKEND

Master Development, Testing & Readiness Document

Project: WGOO Real-Money Gaming Backend
Repository: "sam02466/Back-end-Wgoo"
Backend Deployment: "https://back-end-wgoo.onrender.com"
Database: Supabase PostgreSQL — Fresh Test Environment
Current Focus: Phase 3 → Phase 4
Testing Strategy: Live API testing against the deployed Render environment
Document Status: Master Working Document
Last Updated: September 2026

---

1. PURPOSE OF THIS DOCUMENT

This document is the master record for the WGOO gaming backend.

Its purpose is to maintain a single source of truth covering:

- What has been built.
- What has been deployed.
- What has actually been tested.
- What has passed.
- What has failed or remains uncertain.
- What limitations currently exist.
- What security properties have been verified.
- What still needs to be tested.
- What behavior we expect from the finished system.
- What must be completed before production deployment.

The central principle of this project is:

«Code existing is not the same as functionality being proven.»

A feature should only be considered verified when it has been exercised through the deployed API and, for financial functionality, its persistent database state has also been validated.

---

2. PROJECT OVERVIEW

WGOO is being developed as a real-money gaming backend capable of supporting:

- User authentication.
- OTP-based login.
- JWT-based authorization.
- User accounts.
- Wallets.
- Financial transactions.
- Game catalogue.
- Game sessions.
- Game launching.
- External gaming-provider integration.
- Provider callbacks.
- Provider transaction processing.
- Idempotency and duplicate protection.
- Ledger-based financial accounting.
- Financial integrity and reconciliation.

The architecture is designed around a separation between:

Application → Wallet/Ledger → Game Session → Provider Adapter → External Provider

The backend should ultimately be capable of safely handling external game-provider events without allowing duplicate callbacks, invalid requests, race conditions, or malformed transactions to corrupt user balances.

---

3. CURRENT SOURCE OF TRUTH

The latest version of the GitHub "main" branch is the source of truth for the current implementation.

Repository:

"sam02466/Back-end-Wgoo"

The deployed Render service is the environment used for current functional testing.

Render API:

"https://back-end-wgoo.onrender.com"

The database is a fresh Supabase test database. There is no important production data that needs to be preserved during current testing.

---

4. CURRENT TECHNOLOGY / ARCHITECTURE

The backend currently contains the following major areas:

Area| Components| Purpose
Application| "src/app.ts", "src/server.ts"| Fastify application and server
Configuration| "src/config/env.ts"| Environment validation/configuration
Database| Prisma + PostgreSQL/Supabase| Persistent data
Authentication| "auth.routes.ts", "auth.service.ts"| OTP authentication and JWT
Users| "user.service.ts"| User creation/retrieval
Wallet| "wallet.routes.ts", "wallet.service.ts"| Wallet functionality
Games| "game.route.ts", "game.service.ts"| Game catalogue
Sessions| "session.routes.ts", "session.service.ts"| Game sessions and launch
Provider Transactions| "provider.service.ts"| Provider financial transactions
Provider Integration| SoftAggregator adapter/services/routes| External provider communication
Providers| "mock.adapter.ts", "softaggregator.adapter.ts", "registry.ts"| Provider abstraction

---

5. DEPLOYMENT & DATABASE STATUS

5.1 Deployment

Render deployment has been successfully established.

The live API is:

"https://back-end-wgoo.onrender.com"

The health endpoint was previously verified successfully.

Expected health response:

{
  "ok": true,
  "service": "gaming-backend",
  "environment": "production"
}

During temporary OTP testing, "NODE_ENV" was changed to development. This must be restored before production.

---

6. DATABASE / MIGRATION STATUS

The fresh Supabase test database experienced an initial migration/schema issue.

That issue was resolved by resetting the public schema and applying the required migrations in the correct order.

Confirmed migrations include:

- "20260919_initial"
- "20260919_phase2_games"

Both migrations were confirmed as applied.

The database is therefore currently suitable for integration testing.

---

7. AUTHENTICATION IMPLEMENTATION

The current authentication flow is:

User identifier
      ↓
OTP Send
      ↓
OTP Challenge stored in database
      ↓
OTP Verification
      ↓
User activated
      ↓
JWT generated
      ↓
JWT used for protected endpoints

The current OTP implementation:

- Normalizes the identifier.
- Creates or retrieves the user.
- Generates an OTP.
- Stores a SHA-256 hash of the OTP.
- Sets a five-minute expiration.
- Tracks failed attempts.
- Marks successful OTP challenges as consumed.
- Creates an authenticated JWT after successful verification.

---

8. TEMPORARY OTP TEST CONFIGURATION

For current development testing, the following configuration was used:

NODE_ENV=development
DEV_OTP_ENABLED=true
DEV_OTP_FIXED_CODE=123456

This allows deterministic OTP testing without implementing a real SMS/email delivery provider yet.

This is intentionally temporary.

Before production:

DEV_OTP_ENABLED

must be disabled and:

DEV_OTP_FIXED_CODE

must be removed.

"NODE_ENV" must also be restored to:

production

---

9. AUTHENTICATION API SURFACE

The currently verified authentication endpoints are:

Endpoint| Method| Authentication
"/api/auth/otp/send"| POST| Public
"/api/auth/otp/verify"| POST| Public
"/api/users/me"| GET| JWT
"/api/auth/logout"| POST| JWT

Important correction:

The correct OTP endpoint is:

/api/auth/otp/send

It is not:

/api/otp/send

---

10. AUTHENTICATION TEST RESULTS

10.1 OTP Send

Status: PASS

Live request successfully returned:

{
  "success": true,
  "userId": "..."
}

This confirms that the deployed backend can create an OTP challenge.

---

10.2 Correct OTP Verification

Status: PASS

Using the configured development OTP:

123456

verification successfully returned a JWT and user information.

The user status became:

ACTIVE

This confirms the complete OTP → user activation → JWT flow.

---

10.3 JWT Generation

Status: PASS

Successful OTP verification generated a JWT containing the user's subject identifier.

The JWT was successfully accepted by the protected API.

---

10.4 Protected "/api/users/me"

Status: PASS

A valid JWT successfully authenticated the request.

The endpoint returned the correct user record, including:

- User ID.
- Email.
- Status.
- Created timestamp.
- Updated timestamp.

This verifies:

JWT
 ↓
Authentication middleware
 ↓
User ID extraction
 ↓
Database lookup
 ↓
Authenticated user response

---

11. LOGOUT TEST

The logout endpoint returned:

{
  "success": true
}

Status: PASS — endpoint behavior

However, an important architectural behavior was observed.

After logout, the same JWT was still accepted by:

/api/users/me

Therefore the current logout implementation does not revoke the JWT.

This is consistent with the current route implementation, which authenticates the request and returns success without maintaining a server-side token blacklist/session revocation mechanism.

Current behavior

Login
 ↓
JWT issued
 ↓
API access
 ↓
Logout
 ↓
JWT still valid until expiration

This should be treated as a documented architectural decision requiring review before production.

It is not being changed prematurely because the current goal is to first test and document the existing backend.

---

12. WRONG OTP TEST

A deliberately incorrect OTP:

000000

was submitted.

The API returned:

{
  "success": false,
  "error": {
    "code": "OTP_INVALID_OR_EXPIRED",
    "message": "Invalid or expired OTP"
  }
}

Status: PASS

The backend correctly rejects an invalid OTP.

---

13. OTP ATTEMPT LIMIT

The implementation contains an attempt check:

attempts >= 5

and increments the attempt counter after an incorrect OTP.

Multiple incorrect OTP requests were tested.

However, the public API intentionally returns the same:

OTP_INVALID_OR_EXPIRED

error for both:

- Invalid OTP.
- Expired OTP.
- Challenge exceeding the attempt limit.

Therefore, the external API response alone does not conclusively demonstrate the database-level attempt limit.

Status

NOT FULLY VERIFIED

The actual "otpChallenge.attempts" database state should be inspected during a dedicated test.

---

14. OTP REPLAY PROTECTION

A clean replay test was performed using a fresh test identifier.

Test sequence:

1. Send OTP
2. Verify OTP successfully
3. Submit the exact same OTP again

The first verification succeeded.

The second verification returned:

{
  "success": false,
  "error": {
    "code": "OTP_INVALID_OR_EXPIRED",
    "message": "Invalid or expired OTP"
  }
}

Status: PASS

This confirms that a successfully used OTP challenge is marked as consumed and cannot simply be replayed.

---

15. AUTHENTICATION TEST SUMMARY

Test| Status| Notes
OTP send| PASS| Challenge created
Correct OTP| PASS| Authentication succeeds
User activation| PASS| User becomes ACTIVE
JWT generation| PASS| Token issued
JWT authentication| PASS| Protected endpoint accepts token
"/api/users/me"| PASS| Correct user returned
Logout endpoint| PASS| Endpoint responds successfully
Token revocation after logout| NOT IMPLEMENTED / OBSERVED| JWT remains valid
Wrong OTP| PASS| Invalid OTP rejected
OTP replay| PASS| Consumed OTP rejected
Five-attempt limit| NOT FULLY VERIFIED| Database-level confirmation required
OTP expiry| NOT YET EXPLICITLY TESTED| Needs dedicated expiry test
Real email delivery| NOT IMPLEMENTED| Intentionally deferred
Real SMS delivery| NOT IMPLEMENTED| Intentionally deferred

---

16. IMPORTANT AUTHENTICATION FINDINGS

Finding AUTH-01 — Development OTP

A fixed OTP is currently enabled for testing.

Risk: High if accidentally deployed to production.

Required action before production:

- Disable development OTP.
- Remove fixed OTP.
- Implement real OTP delivery.
- Verify production environment configuration.

---

Finding AUTH-02 — Logout Does Not Revoke JWT

The current logout endpoint does not invalidate an already issued JWT.

Current behavior: JWT remains usable until expiration.

Possible future approaches include:

- Short-lived access tokens.
- Refresh tokens.
- Server-side sessions.
- Token versioning.
- Token revocation/blacklisting.

The final approach should be chosen deliberately rather than changing the current implementation during unrelated testing.

---

Finding AUTH-03 — OTP Attempt Limit Needs Direct Verification

The code contains an attempt limit, but the public response does not expose the difference between an ordinary invalid OTP and an exhausted challenge.

The database state should therefore be inspected during a dedicated test.

---

Finding AUTH-04 — Real OTP Delivery Is Not Yet Implemented

SMS/email delivery is intentionally deferred.

Current objective:

«First prove the backend's authentication logic, then add the real delivery layer.»

---

17. SECURITY CREDENTIAL HANDLING

JWTs were temporarily displayed during debugging.

Those tokens should be treated as exposed credentials.

For future testing:

- Never paste production JWTs into documentation.
- Never paste API passwords.
- Never paste provider salt keys.
- Never paste database URLs containing credentials.
- Never paste production secrets into chat.
- Use temporary test credentials during development.
- Rotate exposed credentials before production.

---

18. CURRENTLY UNTESTED / NOT FULLY VERIFIED AREAS

The following areas still require testing:

Wallet

- Wallet creation.
- Initial balance.
- Balance retrieval.
- Credit.
- Debit.
- Insufficient balance.
- Negative amounts.
- Zero amounts.
- Decimal precision.
- Duplicate transaction handling.
- Concurrent debits.
- Ledger consistency.
- Rollback behavior.

Games

- Game catalogue.
- Game retrieval.
- Game availability.
- Authentication requirements.
- Invalid game IDs.
- Game launch.

Game Sessions

- Session creation.
- Session ownership.
- Duplicate session behavior.
- Session expiration.
- Invalid session handling.
- Provider session linkage.

Provider Integration

- Provider callback authentication.
- Signature verification.
- Timestamp validation.
- Malformed callback rejection.
- Duplicate callbacks.
- Retry behavior.
- Provider transaction idempotency.
- Credit/debit behavior.
- Rollback behavior.

Financial Integrity

- Concurrent transactions.
- Race conditions.
- Overspending.
- Double credits.
- Double debits.
- Database transaction rollback.
- Wallet/ledger consistency.
- Reconciliation.

Production Security

- CORS configuration.
- Rate limiting.
- Abuse protection.
- JWT lifecycle.
- Secret management.
- Error information leakage.
- Logging.
- Provider credentials.
- Callback security.
- Production environment configuration.

---

19. MASTER TESTING ROADMAP

PHASE A — AUTHENTICATION

Objective

Prove that user authentication is reliable and resistant to basic abuse.

Tests

- OTP send.
- Correct OTP.
- Wrong OTP.
- OTP expiration.
- OTP replay.
- OTP attempt limit.
- Multiple OTP requests.
- Identifier normalization.
- Malformed identifiers.
- Malformed OTP.
- JWT authentication.
- Missing JWT.
- Invalid JWT.
- Expired JWT.
- Logout behavior.

Exit condition

Authentication behavior is understood and all critical security properties are demonstrated.

---

20. PHASE B — WALLET

This is the next major testing stage.

The wallet should be tested first with read-only operations and ordinary happy paths.

Then negative cases.

Then adversarial cases.

Finally concurrency tests.

The fundamental rule is:

«A successful HTTP response is not sufficient evidence that money was handled correctly.»

Every financial mutation must be checked against the database state.

---

21. PHASE C — GAME CATALOGUE

Test:

- List games.
- Retrieve individual game.
- Invalid game ID.
- Active/inactive games.
- Provider association.
- Game metadata.
- Authorization behavior.

---

22. PHASE D — GAME SESSIONS

Test:

Authenticated user
      ↓
Valid game
      ↓
Game launch
      ↓
Session creation
      ↓
Provider/session information

Negative tests should include:

- Invalid user.
- Invalid JWT.
- Invalid game.
- Disabled game.
- Duplicate launch.
- Invalid session.
- Unauthorized session access.

---

23. PHASE E — PROVIDER CALLBACKS

Provider callbacks are security-critical because they can potentially modify wallet state.

The backend should validate:

1. Authentication/signature.
2. Provider identity.
3. Transaction ID.
4. Amount.
5. Currency.
6. Timestamp.
7. Transaction type.
8. User/player mapping.
9. Idempotency.
10. Database transaction integrity.

Only after validation should a financial mutation occur.

---

24. PHASE F — FINANCIAL INTEGRITY / PHASE 4

This is the most important testing stage.

The purpose is to determine whether the system remains financially correct under normal operation, retries, failures and concurrency.

---

25. PHASE 4 TEST MATRIX

Test| Scenario| Expected Property
Duplicate callback| Same provider transaction twice| Only one financial effect
Concurrent debit| Multiple simultaneous debits| No overspending
Insufficient balance| Debit exceeds balance| Rejected without mutation
Credit without debit| Unexpected provider credit| Must follow explicit business rule
Signature failure| Invalid provider signature| Rejected without mutation
Stale timestamp| Old callback| Rejected according to configured policy
Malformed amount| Invalid/negative/zero amount| Rejected safely
Retry| Provider repeats request| Idempotent
DB rollback| Operation fails midway| No partial financial state
Wallet/ledger consistency| Compare aggregate state| Invariant maintained
Reconciliation| Reconstruct wallet from ledger| No unexplained discrepancy
Sandbox E2E| Provider → wallet → game| Complete traceable flow

---

26. FINANCIAL INVARIANTS

The backend should ultimately satisfy strong invariants.

Examples:

No Negative Balance

A wallet should never become negative unless the business model explicitly allows it.

No Duplicate Financial Effect

The same provider transaction must not credit/debit the wallet twice.

Atomicity

A financial operation should either:

COMMIT completely

or:

ROLLBACK completely

There must not be a state where the wallet changes but the corresponding ledger transaction fails to persist.

Traceability

Every financial event should be traceable using stable identifiers.

Reconciliation

The wallet's effective balance should be explainable from its financial history.

---

27. CONCURRENCY TESTING

Sequential testing is insufficient for a real-money wallet.

For example:

Starting balance = ₹100

Request A → debit ₹80
Request B → debit ₹80

If both requests are accepted incorrectly, the system could create an impossible financial state.

Therefore, the backend must be tested with genuinely concurrent requests.

The expected result should ensure that the system never allows more money to be spent than is available.

---

28. IDEMPOTENCY TESTING

External providers may retry callbacks when they do not receive a response.

Example:

Provider
   ↓
Debit callback
   ↓
Backend processes transaction
   ↓
Network timeout
   ↓
Provider retries same transaction

The backend must recognize the repeated transaction.

Expected:

First request  → financial effect
Second request → no additional financial effect

This is one of the most important properties of the provider integration.

---

29. FAILURE / ROLLBACK TESTING

Financial operations must be tested under artificial failure conditions.

Example:

Validate request
      ↓
Update wallet
      ↓
Ledger operation fails

The expected behavior is not:

Wallet changed
Ledger missing

Instead:

Transaction rollback
      ↓
Original wallet state preserved
      ↓
No inconsistent financial state

---

30. PROVIDER SECURITY TESTING

Provider callback testing should include:

Valid Signature

Expected:

Accepted

Invalid Signature

Expected:

Rejected
No financial mutation

Missing Signature

Expected:

Rejected

Invalid Timestamp

Expected:

Rejected

Replay

Expected:

No duplicate financial effect

Malformed Amount

Expected:

Rejected
No financial mutation

---

31. PRODUCTION READINESS DEFINITION

The backend should not be considered ready for real-money production merely because:

- Render deploys successfully.
- "/health" works.
- Login works.
- Games appear.
- A provider callback returns HTTP 200.

Production readiness requires evidence across the entire system.

---

32. PRODUCTION READINESS CHECKLIST

Authentication

- [ ] OTP send tested.
- [x] Correct OTP tested.
- [x] Wrong OTP tested.
- [x] OTP replay tested.
- [ ] OTP expiration tested explicitly.
- [ ] Attempt limit verified at database level.
- [ ] JWT invalid token tested.
- [ ] JWT expiration tested.
- [ ] Logout architecture finalized.
- [ ] Real email/SMS OTP implemented.
- [ ] Development OTP disabled.

Wallet

- [ ] Wallet creation tested.
- [ ] Balance retrieval tested.
- [ ] Credit tested.
- [ ] Debit tested.
- [ ] Insufficient balance tested.
- [ ] Negative/zero amount rejected.
- [ ] Duplicate transaction protection tested.
- [ ] Concurrent debit tested.
- [ ] Wallet/ledger consistency tested.
- [ ] Rollback tested.

Games

- [ ] Catalogue tested.
- [ ] Game lookup tested.
- [ ] Invalid game handling tested.
- [ ] Game launch tested.
- [ ] Authorization tested.

Sessions

- [ ] Session creation tested.
- [ ] Session ownership tested.
- [ ] Invalid session tested.
- [ ] Duplicate session behavior tested.
- [ ] Provider session mapping tested.

Provider

- [ ] Valid callback tested.
- [ ] Invalid signature tested.
- [ ] Missing signature tested.
- [ ] Replay tested.
- [ ] Duplicate transaction tested.
- [ ] Timestamp tested.
- [ ] Malformed amount tested.
- [ ] Provider retry tested.
- [ ] Provider failure tested.

Financial Integrity

- [ ] Concurrent d