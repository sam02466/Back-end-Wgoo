-- Initial core schema for gaming backend.
-- Creates users, wallets, financial transactions,
-- ledger entries, provider transactions and OTP challenges.

CREATE TYPE "UserStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'BLOCKED',
  'PENDING'
);

CREATE TYPE "WalletStatus" AS ENUM (
  'ACTIVE',
  'FROZEN',
  'CLOSED'
);

CREATE TYPE "FinancialTransactionType" AS ENUM (
  'DEPOSIT',
  'BET',
  'WIN',
  'ROLLBACK',
  'WITHDRAWAL',
  'ADJUSTMENT',
  'REFUND'
);

CREATE TYPE "TransactionStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REVERSED'
);

CREATE TYPE "ProviderTransactionType" AS ENUM (
  'BALANCE',
  'DEBIT',
  'CREDIT',
  'ROLLBACK'
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_phone_key"
  ON "users"("phone");

CREATE UNIQUE INDEX "users_email_key"
  ON "users"("email");


CREATE TABLE "wallets" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_userId_currency_key"
  ON "wallets"("userId", "currency");

CREATE INDEX "wallets_userId_idx"
  ON "wallets"("userId");


CREATE TABLE "financial_transactions" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "amount" DECIMAL(20,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'SUCCESS',
  "reference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financial_transactions_userId_createdAt_idx"
  ON "financial_transactions"("userId", "createdAt");

CREATE INDEX "financial_transactions_walletId_createdAt_idx"
  ON "financial_transactions"("walletId", "createdAt");

CREATE INDEX "financial_transactions_reference_idx"
  ON "financial_transactions"("reference");


CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "amount" DECIMAL(20,2) NOT NULL,
  "balanceBefore" DECIMAL(20,2) NOT NULL,
  "balanceAfter" DECIMAL(20,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "reference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ledger_entries_walletId_createdAt_idx"
  ON "ledger_entries"("walletId", "createdAt");

CREATE INDEX "ledger_entries_transactionId_idx"
  ON "ledger_entries"("transactionId");


CREATE TABLE "provider_transactions" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerTransactionId" TEXT NOT NULL,
  "providerRoundId" TEXT,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "financialTransactionId" TEXT,
  "type" "ProviderTransactionType" NOT NULL,
  "amount" DECIMAL(20,2),
  "currency" TEXT NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'SUCCESS',
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "provider_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_transactions_provider_providerTransactionId_key"
  ON "provider_transactions"("provider", "providerTransactionId");

CREATE INDEX "provider_transactions_userId_createdAt_idx"
  ON "provider_transactions"("userId", "createdAt");

CREATE INDEX "provider_transactions_provider_providerRoundId_idx"
  ON "provider_transactions"("provider", "providerRoundId");


CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "identifier" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_challenges_identifier_createdAt_idx"
  ON "otp_challenges"("identifier", "createdAt");

CREATE INDEX "otp_challenges_expiresAt_idx"
  ON "otp_challenges"("expiresAt");


ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_walletId_fkey"
  FOREIGN KEY ("walletId")
  REFERENCES "wallets"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_walletId_fkey"
  FOREIGN KEY ("walletId")
  REFERENCES "wallets"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_transactionId_fkey"
  FOREIGN KEY ("transactionId")
  REFERENCES "financial_transactions"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "provider_transactions"
  ADD CONSTRAINT "provider_transactions_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "provider_transactions"
  ADD CONSTRAINT "provider_transactions_walletId_fkey"
  FOREIGN KEY ("walletId")
  REFERENCES "wallets"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "provider_transactions"
  ADD CONSTRAINT "provider_transactions_financialTransactionId_fkey"
  FOREIGN KEY ("financialTransactionId")
  REFERENCES "financial_transactions"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;