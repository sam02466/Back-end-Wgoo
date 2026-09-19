# Real-Money Gaming Backend — Phase 3

Phase 3 connects the Phase 1/2 backend to the **SoftAggregator seamless-wallet API** behind a provider adapter.

> This repository is an engineering integration scaffold. Do not enable real-money operation until the required legal/regulatory, KYC/AML, payments, responsible-gaming, provider-contract, security and operational controls for the intended jurisdiction are satisfied.

## What Phase 3 adds

- SoftAggregator REST adapter using its documented `/api/v1` endpoint.
- `getGameList` catalogue synchronization.
- `createPlayer` before launch.
- `getGame` launch URL generation.
- INR/local-currency support through the wallet callback.
- SoftAggregator GET wallet callback endpoint.
- Callback signature validation: `md5(timestamp + salt_key)` with a 30-second timestamp window.
- Balance, debit and credit processing.
- Callback idempotency by `call_id`.
- Provider transaction + round tracking.
- Provider request payload audit data.
- Minor-unit conversion: provider cents/minor units ↔ internal two-decimal wallet amounts.
- Insufficient-balance response using SoftAggregator error code `1`.
- Provider/processing errors returned as HTTP 200 with JSON error code `2`, as required by the provider documentation.
- Deterministic provider player credentials derived from a server-only secret, so provider passwords are not stored in plaintext.
- A SoftAggregator catalogue sync command.

## Verified provider contract used by this code

SoftAggregator's current public documentation states:

- API base URL: `https://api.softaggregator.com/api/v1`.
- API requests are POST JSON with `api_login`, `api_password` and a `method`.
- Game catalogue uses `id_hash` as the launch `gameid` and `game_type` as the normalized category.
- Launch uses `createPlayer`, followed by `getGame`.
- Wallet callbacks are GET requests and must always receive HTTP 200; provider-level errors are communicated in JSON.
- Callback balances and amounts are integer minor units.
- `call_id` is the unique transaction identifier for de-duplication.
- Signature is `md5(timestamp + salt_key)` and the documented timestamp tolerance is 30 seconds.
- `type` is informational; the callback handler branches on `action`.
- Credits can arrive without a matching debit, so the backend does not require a previous bet before a credit.

Source: SoftAggregator's public API documentation: https://softaggregator.com/docs.html

## Environment

Copy `.env.example` to `.env` and set your existing Phase 1/2 variables plus:

```env
SOFTAGGREGATOR_ENABLED=false
SOFTAGGREGATOR_BASE_URL=https://api.softaggregator.com/api/v1
SOFTAGGREGATOR_API_LOGIN=
SOFTAGGREGATOR_API_PASSWORD=
SOFTAGGREGATOR_SALT_KEY=
SOFTAGGREGATOR_PLAYER_SECRET=replace-with-a-random-32-plus-character-secret
SOFTAGGREGATOR_TIMEOUT_MS=10000
```

Keep `SOFTAGGREGATOR_ENABLED=false` until the credentials and callback URL have been configured and tested in the provider sandbox/test environment.

## Install/build

```bash
npm install
npx prisma generate
npm run typecheck
npm test
npm run build
```

## Sync the SoftAggregator game catalogue

After credentials are configured:

```bash
npm run games:sync:softaggregator
```

The command upserts games into the local `games` table. It uses the provider's exact `id_hash` as `providerGameId`.

## Game launch

Authenticated endpoint:

```http
POST /api/games/:gameId/launch
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "currency": "INR",
  "language": "en",
  "device": "mobile",
  "country": "IN",
  "homeUrl": "https://your-frontend.example/games"
}
```

The backend creates/ensures the SoftAggregator player and requests a launch URL. The provider password is derived from `SOFTAGGREGATOR_PLAYER_SECRET` and the internal user ID; it is never returned to the frontend.

## Wallet callback

Configure the provider callback URL as:

```text
https://YOUR_BACKEND_DOMAIN/api/providers/softaggregator/wallet
```

The provider calls this URL with query parameters such as:

```text
username
currency
action
amount
type
round_id
game_id
call_id
timestamp
rb
key
```

Example balance response:

```json
{"error":0,"balance":12500}
```

`12500` means `125.00` in a two-decimal currency.

### Debit

A debit decreases the internal wallet and writes:

1. financial transaction (`BET`)
2. wallet balance change
3. immutable ledger entry
4. provider transaction

If funds are insufficient, the callback returns:

```json
{"error":1,"balance":<current_balance_in_minor_units>}
```

### Credit

A credit increases the wallet and writes a `WIN` financial transaction plus ledger/provider records. The handler intentionally does **not** require a matching debit because the provider documents that free-spin/bonus/jackpot credits can arrive without one.

### Idempotency

`call_id` is the provider's unique callback transaction ID. A repeated callback does not apply the wallet mutation again; it returns the current balance.

### Rollback flag

The current SoftAggregator documentation describes `rb=1` as a rollback marker while instructing the operator to process the callback according to its normal debit/credit movement semantics. This implementation preserves the flag in the provider transaction payload and **does not infer or reverse an arbitrary previous round**. That avoids guessing which leg should be reversed when a round has multiple wallet movements.

The Phase 2 explicit rollback linkage remains available for providers whose contract supplies a concrete original transaction ID.

## Security notes

- Never commit `.env` or provider credentials.
- Use HTTPS in every non-local environment.
- Keep `SOFTAGGREGATOR_SALT_KEY` server-side only.
- Keep `SOFTAGGREGATOR_PLAYER_SECRET` server-side only.
- Do not expose provider API credentials to the browser.
- The callback is intentionally unauthenticated at the application/JWT layer because the provider authenticates it with its timestamp/key protocol.
- The callback returns HTTP 200 for provider-level failures because that is part of the documented contract.
- Monitor repeated signature failures and provider errors in production.

## Phase 3 flow

```text
Frontend
   |
   | JWT launch request
   v
Gaming Backend
   |
   +--> Game DB
   |
   +--> SoftAggregator Adapter
           |
           +--> createPlayer
           |
           +--> getGame
           |
           +--> launch URL

SoftAggregator
   |
   | GET wallet callback
   v
/api/providers/softaggregator/wallet
   |
   +--> verify timestamp + MD5 signature
   +--> resolve internal user
   +--> idempotency by call_id
   +--> lock/mutate wallet transactionally
   +--> write financial transaction
   +--> write ledger
   +--> write provider transaction
   +--> return current balance
```

## Phase 4 next

Phase 4 should focus on **financial and provider integration testing** before any production-money enablement:

- duplicate callback races
- concurrent debit tests
- insufficient balance
- credit without debit
- signature failures
- stale timestamp
- malformed amounts
- provider timeout/retry behaviour
- DB failure/rollback
- wallet/ledger consistency
- provider transaction reconciliation
- sandbox end-to-end launch and wallet lifecycle

## Phase 4 — Financial Integrity & Testing

This version includes automated wallet invariant tests, callback signature tests, a concurrency model, and optional PostgreSQL integration tests. Run `npm test` for the complete local suite. Set `RUN_DB_TESTS=1` with a dedicated test `DATABASE_URL` to enable the PostgreSQL tests.

Do not point the database test suite at production.
