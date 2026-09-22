WGOO Phase 4 — Wallet & Provider Callback Live Test Report

Project: WGOO Gaming Backend
Repository: "sam02466/Back-end-Wgoo"
Live Backend: "https://back-end-wgoo.onrender.com"
Database: Fresh Supabase PostgreSQL test database
Environment: Render deployment
Testing Date: 2026-09-21
Status: Phase 4 testing in progress

---

1. Purpose

This document records the Phase 4 wallet and provider-callback tests that have actually been executed against the deployed WGOO backend.

The purpose is to maintain a clear distinction between:

- tests that have actually passed,
- tests that are still pending,
- known limitations,
- observations that are not failures.

The latest GitHub "main" branch is the source of truth.

---

2. Test Environment

Backend

- Repository: "sam02466/Back-end-Wgoo"
- Deployment: Render
- Base URL: "https://back-end-wgoo.onrender.com"
- "/health" endpoint verified successfully.
- Render deployment verified successfully.

Database

- Supabase PostgreSQL
- Fresh test database
- No important production data
- Prisma migrations confirmed applied:
  - "20260919_initial"
  - "20260919_phase2_games"

SoftAggregator configuration

Configured on Render:

SOFTAGGREGATOR_ENABLED=true
SOFTAGGREGATOR_SALT_KEY=<configured privately>

The actual provider API login/password/player secret were not required for the internal wallet callback tests.

These tests did not consume the external SoftAggregator prepaid balance because they exercised the deployed callback endpoint directly.

---

3. Wallet Endpoint Tests

3.1 Wallet creation / initial state

PASS

"GET /api/wallet" successfully returned the authenticated user's INR wallet.

Initial state:

Currency: INR
Balance: ₹0.00
Status: ACTIVE

---

3.2 Wallet retrieval

PASS

The authenticated wallet endpoint successfully returned the expected wallet.

The wallet remained associated with the test user.

---

3.3 Wallet transactions endpoint

PASS

"GET /api/wallet/transactions" successfully returned the wallet ledger.

Transactions were returned in descending creation order.

---

3.4 Authentication protection

PASS

Wallet endpoints were tested without authentication and with an invalid token.

Expected authentication failure was returned:

{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

---

3.5 Currency validation

PASS

Tested:

currency=inr → accepted
currency=IN → rejected
currency=USD → separate USD wallet created

The INR wallet remained unaffected by the USD wallet test.

---

4. Provider Callback Tests

Callback endpoint:

GET /api/providers/softaggregator/wallet

The callback uses:

MD5(timestamp + SOFTAGGREGATOR_SALT_KEY)

for signature verification.

---

4.1 Valid balance callback

PASS

A correctly signed balance callback returned:

{
  "error": 0,
  "balance": 0
}

This verified:

- callback authentication,
- timestamp handling,
- user lookup,
- wallet lookup,
- provider balance conversion.

---

5. Credit and Debit Tests

5.1 Credit

PASS

Provider credit:

100 cents = ₹1.00

Response:

{
  "error": 0,
  "balance": 100
}

Wallet:

₹0.00 → ₹1.00

Ledger:

Type: WIN
Amount: +₹1.00
Balance before: ₹0.00
Balance after: ₹1.00

---

5.2 Debit

PASS

Provider debit:

50 cents = ₹0.50

Response:

{
  "error": 0,
  "balance": 50
}

Wallet:

₹1.00 → ₹0.50

Ledger:

Type: BET
Amount: -₹0.50
Balance before: ₹1.00
Balance after: ₹0.50

---

6. Amount Validation

6.1 Negative amount

PASS

Test:

amount=-100

Response:

{
  "error": 2,
  "balance": 50
}

No wallet mutation occurred.

---

6.2 Zero amount

PASS

Test:

amount=0

Response:

{
  "error": 2,
  "balance": 50
}

Wallet remained:

₹0.50

---

6.3 Decimal provider amount

PASS

Test:

amount=1.5

Response:

{
  "error": 2,
  "balance": 50
}

The malformed decimal provider amount was rejected.

The callback expects integer cents.

---

6.4 Smallest valid amount — ₹0.01

PASS

Provider credit:

amount=1

Result:

₹0.50 → ₹0.51

Response:

{
  "error": 0,
  "balance": 51
}

A subsequent 1-cent debit restored the wallet:

₹0.51 → ₹0.50

This verifies ₹0.01 precision.

---

7. Insufficient Funds

PASS

With:

Available balance: ₹0.50

a debit of:

₹1.00

was attempted.

Response:

{
  "error": 1,
  "balance": 50
}

The wallet remained:

₹0.50

No successful financial ledger mutation was created for the rejected debit.

Negative wallet balance was therefore prevented.

---

8. Callback Security Tests

8.1 Valid signature

PASS

Correctly signed callbacks were accepted.

---

8.2 Invalid signature

PASS

A deliberately invalid signature was supplied.

Response:

{
  "error": 2,
  "balance": 0
}

The request was rejected.

The "balance:0" is the error response value and does not mean the actual wallet was set to zero.

---

8.3 Expired timestamp

PASS

A callback using a timestamp approximately 60 seconds in the past was rejected.

Response:

{
  "error": 2,
  "balance": 0
}

The actual wallet was then checked separately and remained:

₹0.50

Therefore:

Expired callback rejected: PASS
Expired callback caused financial mutation: NO

---

8.4 Malformed callback

PASS

A callback with the required "call_id" field missing was rejected.

Response:

{
  "error": 2,
  "balance": 0
}

No wallet mutation occurred.

---

9. Provider Idempotency / Retry Tests

9.1 Duplicate credit

PASS

The same credit "call_id" was submitted twice.

First request:

{
  "error": 0,
  "balance": 100
}

Duplicate request:

{
  "error": 0,
  "balance": 100
}

The credit was applied only once.

---

9.2 Duplicate debit / provider retry

PASS

Before test:

₹0.50

First debit:

₹0.50 → ₹0.49

Response:

{
  "error": 0,
  "balance": 49
}

The exact same provider "call_id" was then submitted again.

Duplicate retry:

{
  "error": 0,
  "balance": 49
}

The balance did not decrease again.

This confirms that the same provider transaction cannot double-charge the wallet.

---

10. Ledger Consistency

PASS

After the duplicate debit test, the wallet transaction history was inspected.

The retry produced exactly one corresponding ledger entry:

Type: BET
Amount: -₹0.01
Balance before: ₹0.50
Balance after: ₹0.49

Reference:
softaggregator:phase4-retry-debit-1790003856

There was no second "BET" ledger entry for the duplicate request.

---

Verified financial sequence

Operation| Before| Change| After
Initial credit| ₹0.00| +₹1.00| ₹1.00
Debit| ₹1.00| −₹0.50| ₹0.50
1-cent credit| ₹0.50| +₹0.01| ₹0.51
1-cent debit| ₹0.51| −₹0.01| ₹0.50
Retry debit| ₹0.50| −₹0.01| ₹0.49
Duplicate retry| ₹0.49| ₹0.00| ₹0.49

The final wallet balance was:

₹0.49 INR

Wallet balance and ledger history were consistent.

---

11. Current Wallet State

At the end of these tests:

Currency: INR
Status: ACTIVE
Balance: ₹0.49

The last successful financial operation was the 1-cent debit used for the retry/idempotency test.

---

12. Important Implementation Fix

During testing, an issue was found in the wallet row-lock query.

The Prisma schema uses:

"userId"

The original raw SQL incorrectly referenced:

user_id

This caused PostgreSQL error:

42703: column "user_id" does not exist

The query was corrected to explicitly use:

SELECT id, "userId", currency, balance, status
FROM wallets
...
FOR UPDATE

The fix was pushed to GitHub and deployed to Render.

Subsequent live credit/debit tests passed, confirming the deployed fix.

---

13. Rollback Status

The internal financial engine already contains rollback validation.

Automated/model-level coverage includes:

- rollback requires a valid original debit,
- rollback amount cannot exceed original debit,
- partial rollback,
- provider transaction linkage,
- duplicate provider transaction handling.

However:

Real SoftAggregator rollback E2E has NOT yet been verified.

The current callback implementation intentionally preserves the provider "rb=1" marker in metadata rather than automatically reversing an arbitrary previous transaction.

This is intentional because a round may contain multiple wallet movements.

Therefore:

Internal rollback engine: COVERED
Real provider rollback E2E: PENDING

---

14. Tests Still Pending

Concurrency / race conditions

- [ ] Concurrent wallet debits
- [ ] Concurrent credits/debits
- [ ] Overspending under simultaneous requests
- [ ] Actual database row-lock contention
- [ ] Serializable transaction behavior under concurrent load

The code contains row locking and serializable transaction handling, but live concurrent DB behavior has not yet been demonstrated.

---

Database transaction integrity

- [ ] Forced DB transaction failure
- [ ] Wallet/ledger atomicity during failure
- [ ] Reconciliation test

---

Provider integration

- [ ] Real SoftAggregator provider E2E
- [ ] Actual provider debit
- [ ] Actual provider credit
- [ ] Actual provider retry behavior
- [ ] Actual provider rollback behavior
- [ ] Game launch/provider failure financial behavior

These should be tested deliberately because the provider account has a real prepaid balance.

---

Production security hardening

Still pending:

- [ ] CORS review
- [ ] Rate limiting
- [ ] Abuse/flood protection
- [ ] OTP expiry
- [ ] OTP attempt limits
- [ ] JWT lifecycle/revocation
- [ ] Provider credential security
- [ ] Callback security review
- [ ] Error leakage review
- [ ] Logging/secret exposure review
- [ ] Production environment review

---

15. Authentication Limitation

Earlier authentication testing established:

Logout endpoint: PASS
JWT revocation after logout: NOT IMPLEMENTED

An already-issued JWT can still authenticate after logout.

This is a future security-hardening item and is not counted as a wallet financial-integrity failure.

---

16. Phase 4 Checkpoint

Confirmed live

- [x] Wallet creation
- [x] Initial balance
- [x] Wallet retrieval
- [x] Currency validation
- [x] Credit
- [x] Debit
- [x] Insufficient funds
- [x] Negative amount rejection
- [x] Zero amount rejection
- [x] Decimal amount rejection
- [x] ₹0.01 precision
- [x] Valid callback signature
- [x] Invalid callback rejection
- [x] Expired timestamp rejection
- [x] Malformed callback rejection
- [x] Duplicate credit idempotency
- [x] Duplicate debit/retry idempotency
- [x] Wallet/ledger consistency
- [x] Rejected callbacks do not mutate wallet

Pending

- [ ] Live concurrency/race testing
- [ ] Overspending under concurrency
- [ ] Live DB transaction failure/rollback
- [ ] Reconciliation
- [ ] Real provider rollback E2E
- [ ] Real SoftAggregator E2E
- [ ] Game-launch financial failure behavior
- [ ] Production security review
- [ ] JWT revocation hardening
- [ ] OTP/rate-limit hardening

---

17. Financial Testing Principle

For financial operations, an HTTP "200" response alone is not considered sufficient evidence.

The verification chain is:

Provider callback response
        ↓
Wallet balance
        ↓
Ledger / financial transaction

A financial test is considered properly verified when these layers agree with one another.

---

18. Current Next Step

The next major Phase 4 test group is:

Concurrency and race-condition testing

This will specifically test whether simultaneous wallet operations can bypass the balance check or produce an overspend.

The current deployed implementation is expected to protect this using:

- PostgreSQL row locking ("FOR UPDATE")
- Serializable transactions
- Wallet balance validation
- Atomic wallet/ledger mutation

These mechanisms still need to be demonstrated through live concurrent testing.

---

Final checkpoint

Current verified wallet balance: "₹0.49 INR"

Wallet/provider callback live testing: Substantial portion completed successfully.

Next test group: Concurrency and financial race-condition testing.