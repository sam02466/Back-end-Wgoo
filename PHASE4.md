# Phase 4 — Financial Integrity & Automated Testing

This phase turns the Phase 1–3 backend into a testable financial system. It adds deterministic wallet invariant tests, provider signature tests, a concurrency model, and optional PostgreSQL integration tests.

## Test layers

1. **Unit/invariant tests** — run anywhere, no database required.
2. **PostgreSQL integration tests** — run only against a disposable test database with `RUN_DB_TESTS=1`.
3. **Provider sandbox E2E** — run after deployment against the actual SoftAggregator sandbox.

## Commands

```bash
npm install
npm test
npm run test:unit
npm run typecheck
```

Database tests:

```bash
RUN_DB_TESTS=1 DATABASE_URL="<TEST_DATABASE_URL>" npm run test:db
```

Never run destructive tests against production.

## Acceptance gates

- Duplicate provider calls do not change the wallet twice.
- Wallet cannot become negative.
- Debit/credit amounts remain exact to two decimals.
- Rollback references an original debit and cannot exceed it.
- Provider transaction IDs are unique.
- Wallet mutations use row locking and serializable transactions.
- Invalid provider signatures are rejected.
- Expired callback signatures are rejected.
- Game launch/provider failures do not create a false successful financial transaction.
- Real sandbox callback behaviour is verified before production credentials are enabled.
