Backend Deployment — Issues, Fixes & Lessons Learned

Project

Gaming Backend — Back-end-Wgoo

Repository:
"sam02466/Back-end-Wgoo"

Deployment:
Render

Database:
Supabase PostgreSQL

Architecture:

GitHub → Render (Fastify/Node.js) → Supabase PostgreSQL

The backend is designed to provide authentication, wallet/ledger management, game integration, provider callbacks, and SoftAggregator integration for the gaming platform.

---

1. Initial Deployment State

The backend codebase contained the main Phase 3/Phase 4 backend components:

- Fastify API
- TypeScript
- Prisma
- PostgreSQL
- JWT authentication
- OTP infrastructure
- Wallet system
- Financial transactions
- Immutable ledger
- Provider transactions
- Idempotency handling
- Game/game-session models
- SoftAggregator adapter
- SoftAggregator callback handling
- Signature verification
- Unit/invariant tests
- PostgreSQL integration tests

The application was therefore substantially implemented, but the deployment configuration had not yet been fully validated against the actual Render + Supabase environment.

---

2. Problem: Prisma Schema Formatting

Error

The first Render build failed with a Prisma schema parsing error:

"P1012"

The schema contained compact/one-line definitions that Prisma was not parsing correctly in the deployment environment.

Fix

The Prisma schema was rewritten into standard multiline Prisma syntax.

Enums and datasource/generator definitions were formatted normally.

After this change:

- Prisma schema loaded successfully.
- Prisma Client generation succeeded.

This moved the build to the TypeScript compilation stage.

---

3. Problem: Node.js TypeScript Definitions

Errors

The next build produced errors such as:

"Cannot find name 'process'"

"Cannot find module 'node:crypto'"

"Cannot find name 'Buffer'"

These appeared in:

- "src/config/env.ts"
- "src/database/prisma.ts"
- "src/modules/auth/auth.service.ts"
- "src/modules/providers/softaggregator.callback.service.ts"
- "src/providers/softaggregator.adapter.ts"
- "src/server.ts"

Initial Investigation

The repository already contained:

"@types/node"

inside "devDependencies".

Therefore, the problem was not that the package was completely absent from the repository.

The problem was that the Render build environment was not consistently making the development dependencies available when TypeScript was compiling the application.

Incorrect Intermediate Fix

An attempt was made to explicitly add:

""types": ["node"]"

to "tsconfig.json".

This produced:

"TS2688: Cannot find type definition file for 'node'."

That demonstrated that TypeScript was being explicitly instructed to load Node types, but the Node type package was not available in that build environment.

The explicit "types" configuration was therefore removed.

Final Fix

The Render Build Command was changed to explicitly install development dependencies:

"npm install --include=dev && npm run build"

This allowed the existing "@types/node" dependency in the repository to be installed during the build.

After this change:

- "process" errors disappeared.
- "Buffer" errors disappeared.
- "node:crypto" errors disappeared.
- TypeScript compilation succeeded.

No unnecessary changes were made to the application source code.

---

4. Problem: TypeScript "unknown" Error in "app.ts"

Error

The application contained an error handler where the caught error was treated as a known object.

With strict TypeScript settings enabled, the error was treated as:

"unknown"

The relevant problem was accessing:

"err.name"

without first establishing that "err" was an Error.

Fix

The check was changed to safely narrow the type:

"err instanceof Error && err.name === "ZodError""

This preserved strict TypeScript checking instead of using an unsafe "any" cast.

After this change, the TypeScript build completed successfully.

---

5. Problem: "NODE_ENV"

Error

Once the application compiled, Render attempted to start it but Zod rejected the environment configuration.

The application expects:

"development"

"test"

or

"production"

The deployment environment needed to use:

"NODE_ENV=production"

Fix

Render was configured with:

"NODE_ENV=production"

This is the correct value for the deployed production service.

---

6. Problem: "DIRECT_URL"

Error

The application then failed during startup because the environment validator required:

"DIRECT_URL"

The error was:

"DIRECT_URL — Too small: expected string to have >=1 characters"

Investigation

The Prisma datasource originally contained:

"directUrl = env("DIRECT_URL")"

The application environment schema also required "DIRECT_URL".

However, the actual Supabase configuration available to the project was:

- Direct connection: IPv6
- Session Pooler: IPv4

Render is using an IPv4 environment.

The Supabase Session Pooler therefore provides the practical database connection for the Render service without requiring Supabase's paid dedicated IPv4 add-on.

Important Lesson

A database connection variable should not be populated with an arbitrary or incompatible connection string simply to satisfy validation.

The database connection architecture needs to match the actual deployment environment.

The "DIRECT_URL" configuration therefore needs to be handled deliberately as part of the Prisma migration/database setup rather than using a fake value.

---

7. Final Render Build Configuration

The successful Render build used:

Build command:

"npm install --include=dev && npm run build"

Start command:

"npm start"

The application starts with:

"node dist/server.js"

Environment:

"NODE_ENV=production"

---

8. Successful Deployment

The final Render deployment produced:

"Build successful"

followed by:

"Server listening at http://127.0.0.1:10000"

and:

"Server listening at http://10.24.141.207:10000"

Render then reported:

"Your service is live"

Primary deployment URL:

"https://back-end-wgoo.onrender.com"

This confirms that:

- GitHub repository was successfully built.
- Prisma Client generation succeeded.
- TypeScript compilation succeeded.
- Node.js runtime started.
- Fastify started successfully.
- Render successfully detected the running service.

---

9. Render 404 on "/"

Render generated a request to:

"HEAD /"

The backend responded:

"404 Route HEAD:/ not found"

This is not a deployment failure.

It simply means the application does not currently expose a root "/" route.

The server itself was already running successfully.

The next endpoint to test is the backend health endpoint rather than assuming "/" should return a response.

---

10. Current Project Status

Completed

GitHub deployment:

DONE

Prisma schema parsing:

FIXED

Prisma Client generation:

WORKING

TypeScript compilation:

WORKING

Node.js type availability during Render build:

FIXED

Strict TypeScript error in "app.ts":

FIXED

Production environment:

CONFIGURED

Fastify server:

RUNNING

Render deployment:

LIVE

Still to verify

Supabase database connectivity

Prisma migrations

Database tables

Health endpoint

Authentication API

OTP flow

Wallet creation

Deposit/credit flow

Debit flow

Insufficient-balance protection

Idempotency

Ledger consistency

Concurrent transactions

Provider callback handling

SoftAggregator signature verification

SoftAggregator test-credit integration

Frontend → backend integration

Production security configuration

---

11. Important Configuration Lessons

Do not create unnecessary files

A "package-lock.json" file was not present in the repository, and creating one manually was unnecessary for solving the deployment problem.

Do not weaken TypeScript

The solution was not to disable strict checking or replace errors with "any".

Do not invent database URLs

Supabase connection strings should come directly from the appropriate Supabase connection configuration.

Do not buy infrastructure unnecessarily

The Supabase dedicated IPv4 add-on is not automatically required simply because Render uses IPv4. The Session Pooler provides an IPv4-compatible connection.

Keep provider credentials disabled until the backend is ready

SoftAggregator should only be enabled after:

1. Backend startup is stable.
2. Database connectivity works.
3. Wallet tests pass.
4. Callback verification passes.
5. Provider test-credit integration is ready.

---

12. Current Architecture

The intended production flow is:

Frontend
↓
Vercel
↓
Render Fastify Backend
↓
Supabase PostgreSQL

For gaming transactions:

SoftAggregator
↓
Backend wallet callback
↓
Wallet service
↓
Financial transaction
↓
Ledger
↓
PostgreSQL

The backend remains the source of truth for wallet balances and financial transactions.

The frontend should never directly modify wallet balances.

---

13. Next Deployment Phase

The next phase is not adding more features.

The next phase is verification.

Recommended order:

1. Verify "/health".
2. Verify Render → Supabase connectivity.
3. Run Prisma migrations.
4. Confirm all expected database tables exist.
5. Test authentication.
6. Test wallet creation.
7. Test financial transactions.
8. Run Phase 4 financial/invariant tests.
9. Configure SoftAggregator test-credit integration.
10. Test provider callbacks.
11. Connect the frontend.
12. Perform end-to-end testing.

Only after these steps should the system be considered ready for production game integration.

---

Deployment Milestone

Current milestone:

RENDER DEPLOYMENT SUCCESSFUL

The project has successfully moved from:

"backend code exists"

to:

"backend compiles and is running on a live Render service."

The remaining work is primarily database verification, financial correctness testing, provider integration, and end-to-end testing.