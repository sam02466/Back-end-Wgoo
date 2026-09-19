-- Phase 2: gaming core and provider rollback linkage.
ALTER TABLE "provider_transactions"
  ADD COLUMN "originalProviderTransactionId" TEXT;

CREATE INDEX "provider_transactions_provider_originalProviderTransactionId_idx"
  ON "provider_transactions"("provider", "originalProviderTransactionId");

CREATE TYPE "GameCategory" AS ENUM ('CRASH', 'INSTANT', 'SLOTS', 'TABLE', 'CARD', 'LIVE_CASINO', 'OTHER');
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "games" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerGameId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "GameCategory" NOT NULL,
  "thumbnail" TEXT,
  "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "games_provider_providerGameId_key"
  ON "games"("provider", "providerGameId");
CREATE INDEX "games_provider_status_idx" ON "games"("provider", "status");
CREATE INDEX "games_category_status_idx" ON "games"("category", "status");

CREATE TABLE "game_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSessionId" TEXT,
  "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "launchUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "game_sessions_userId_status_createdAt_idx"
  ON "game_sessions"("userId", "status", "createdAt");
CREATE INDEX "game_sessions_gameId_status_idx"
  ON "game_sessions"("gameId", "status");
CREATE INDEX "game_sessions_provider_providerSessionId_idx"
  ON "game_sessions"("provider", "providerSessionId");

ALTER TABLE "game_sessions"
  ADD CONSTRAINT "game_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "game_sessions"
  ADD CONSTRAINT "game_sessions_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
