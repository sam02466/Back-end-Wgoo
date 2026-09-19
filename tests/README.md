# Phase 4 test strategy

## Offline tests

Run:

```bash
npm test
```

These tests do not need Supabase. They validate the critical wallet invariants and signature construction.

## Database integration tests

After deploying a disposable/test PostgreSQL database and applying migrations:

```bash
RUN_DB_TESTS=1 DATABASE_URL="..." npm test
```

The database tests create records with unique markers and clean them up. Use a dedicated test database; never point this at a production wallet database.

## Production sandbox tests

After offline + database tests pass, deploy to Render and connect the Vercel frontend and SoftAggregator sandbox. Then verify the real provider callbacks, game launch and wallet lifecycle. Never use production money for these tests.
