import { afterAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { processProviderMutation } from "../src/modules/provider-transactions/provider.service.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled = Boolean(databaseUrl && process.env.RUN_DB_TESTS === "1");
const describeDb = enabled ? describe : describe.skip;

const prisma = enabled ? new PrismaClient() : null;

describeDb("provider rollback database integration", () => {
  const marker = `rollback-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let userId: string;
  let walletId: string;

  afterAll(async () => {
    if (!prisma || !userId) {
      if (prisma) await prisma.$disconnect();
      return;
    }

    // Relations use onDelete: Restrict, so remove children first.
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });

    const walletIds = wallets.map((wallet) => wallet.id);

    if (walletIds.length) {
      await prisma.ledgerEntry.deleteMany({
        where: { walletId: { in: walletIds } },
      });

      await prisma.providerTransaction.deleteMany({
        where: { walletId: { in: walletIds } },
      });

      await prisma.financialTransaction.deleteMany({
        where: { walletId: { in: walletIds } },
      });

      await prisma.wallet.deleteMany({
        where: { id: { in: walletIds } },
      });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await prisma.$disconnect();
  });

  it("creates a debit through the real provider mutation service", async () => {
    const user = await prisma!.user.create({
      data: {
        email: `${marker}@example.test`,
        status: "ACTIVE",
      },
    });

    userId = user.id;

    const wallet = await prisma!.wallet.create({
      data: {
        userId,
        currency: "USD",
        balance: new Prisma.Decimal("2.00"),
      },
    });

    walletId = wallet.id;

    const result = await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: `${marker}-debit`,
      providerRoundId: `${marker}-round`,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("1.00"),
      type: "DEBIT",
      requestPayload: {
        test: true,
        phase: "rollback",
      },
    });

    expect(result.idempotent).toBe(false);
    expect(result.providerTransaction.type).toBe("DEBIT");
    expect(result.providerTransaction.provider).toBe("rollback-test");
    expect(result.providerTransaction.amount?.toString()).toBe("1.00");

    const walletAfter = await prisma!.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });

    expect(walletAfter.balance.toString()).toBe("1.00");
  });

  it("rolls back the original debit through the real service", async () => {
    const debitId = `${marker}-debit`;
    const rollbackId = `${marker}-rollback`;

    const result = await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: rollbackId,
      providerRoundId: `${marker}-round`,
      originalProviderTransactionId: debitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("1.00"),
      type: "ROLLBACK",
      requestPayload: {
        test: true,
        phase: "rollback",
      },
    });

    expect(result.idempotent).toBe(false);
    expect(result.providerTransaction.type).toBe("ROLLBACK");
    expect(result.providerTransaction.originalProviderTransactionId).toBe(debitId);

    const walletAfter = await prisma!.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });

    expect(walletAfter.balance.toString()).toBe("2.00");

    const ledger = await prisma!.ledgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" },
    });

    expect(ledger).toHaveLength(2);
    expect(ledger[0].type).toBe("BET");
    expect(ledger[1].type).toBe("ROLLBACK");

    expect(ledger[0].balanceAfter.toString()).toBe("1");
    expect(ledger[1].balanceBefore.toString()).toBe("1");
    expect(ledger[1].balanceAfter.toString()).toBe("2");
  });

  it("is idempotent when the same rollback transaction is retried", async () => {
    const debitId = `${marker}-debit`;
    const rollbackId = `${marker}-rollback`;

    const result = await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: rollbackId,
      originalProviderTransactionId: debitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("1.00"),
      type: "ROLLBACK",
      requestPayload: {
        test: true,
        retry: true,
      },
    });

    expect(result.idempotent).toBe(true);
    expect(result.providerTransaction.providerTransactionId).toBe(rollbackId);

    const walletAfter = await prisma!.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });

    expect(walletAfter.balance.toString()).toBe("2.00");

    const rollbackCount = await prisma!.providerTransaction.count({
      where: {
        provider: "rollback-test",
        originalProviderTransactionId: debitId,
        type: "ROLLBACK",
      },
    });

    expect(rollbackCount).toBe(1);
  });

  it("rejects a rollback without an original transaction ID", async () => {
    await expect(
      processProviderMutation({
        provider: "rollback-test",
        providerTransactionId: `${marker}-missing-original`,
        userId,
        currency: "USD",
        amount: new Prisma.Decimal("1.00"),
        type: "ROLLBACK",
      }),
    ).rejects.toMatchObject({
      code: "ROLLBACK_ORIGINAL_REQUIRED",
    });
  });

  it("rejects a rollback for a nonexistent original transaction", async () => {
    await expect(
      processProviderMutation({
        provider: "rollback-test",
        providerTransactionId: `${marker}-missing-target`,
        originalProviderTransactionId: `${marker}-does-not-exist`,
        userId,
        currency: "USD",
        amount: new Prisma.Decimal("1.00"),
        type: "ROLLBACK",
      }),
    ).rejects.toMatchObject({
      code: "ORIGINAL_TRANSACTION_NOT_FOUND",
    });
  });

  it("rejects a rollback targeting a credit", async () => {
    const creditId = `${marker}-credit`;

    await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: creditId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("0.50"),
      type: "CREDIT",
      requestPayload: {
        test: true,
      },
    });

    await expect(
      processProviderMutation({
        provider: "rollback-test",
        providerTransactionId: `${marker}-invalid-credit-rollback`,
        originalProviderTransactionId: creditId,
        userId,
        currency: "USD",
        amount: new Prisma.Decimal("0.50"),
        type: "ROLLBACK",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ROLLBACK_TARGET",
    });

    const walletAfter = await prisma!.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });

    expect(walletAfter.balance.toString()).toBe("2.50");
  });

  it("rejects a rollback larger than the original debit", async () => {
    const secondDebitId = `${marker}-second-debit`;

    await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: secondDebitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("0.50"),
      type: "DEBIT",
      requestPayload: {
        test: true,
      },
    });

    await expect(
      processProviderMutation({
        provider: "rollback-test",
        providerTransactionId: `${marker}-oversized-rollback`,
        originalProviderTransactionId: secondDebitId,
        userId,
        currency: "USD",
        amount: new Prisma.Decimal("0.51"),
        type: "ROLLBACK",
      }),
    ).rejects.toMatchObject({
      code: "ROLLBACK_AMOUNT_TOO_LARGE",
    });
  });

  it("documents the current cumulative partial-rollback behavior", async () => {
    const partialDebitId = `${marker}-partial-debit`;

    await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: partialDebitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("0.20"),
      type: "DEBIT",
    });

    const firstRollback = await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: `${marker}-partial-rb-1`,
      originalProviderTransactionId: partialDebitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("0.15"),
      type: "ROLLBACK",
    });

    expect(firstRollback.idempotent).toBe(false);

    const secondRollback = await processProviderMutation({
      provider: "rollback-test",
      providerTransactionId: `${marker}-partial-rb-2`,
      originalProviderTransactionId: partialDebitId,
      userId,
      currency: "USD",
      amount: new Prisma.Decimal("0.15"),
      type: "ROLLBACK",
    });

    /*
     * This intentionally documents CURRENT behavior.
     *
     * The service checks each rollback against the original debit
     * independently, but does not currently cap the SUM of all
     * rollback transactions against the original debit.
     *
     * Therefore 0.15 + 0.15 can currently exceed the original
     * 0.20 debit.
     *
     * This is a future financial-integrity hardening item, not
     * the desired invariant.
     */
    expect(secondRollback.idempotent).toBe(false);

    const partialRollbacks = await prisma!.providerTransaction.aggregate({
      _sum: { amount: true },
      where: {
        provider: "rollback-test",
        originalProviderTransactionId: partialDebitId,
        type: "ROLLBACK",
      },
    });

    expect(partialRollbacks._sum.amount?.toString()).toBe("0.30");
  });
});
