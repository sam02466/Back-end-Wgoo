import { describe, expect, it } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
const enabled = Boolean(databaseUrl && process.env.RUN_DB_TESTS === '1');
const describeDb = enabled ? describe : describe.skip;

const prisma = enabled ? new PrismaClient() : null;

describeDb('database financial integration tests', () => {
  const marker = `phase4-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  it('can create a wallet and preserves two-decimal money', async () => {
    const user = await prisma!.user.create({ data: { email: `${marker}@example.test`, status: 'ACTIVE' } });
    const wallet = await prisma!.wallet.create({ data: { userId: user.id, currency: 'INR', balance: new Prisma.Decimal('123.45') } });
    expect(wallet.balance.toString()).toBe('123.45');
  });

  it('serializes a row lock transaction', async () => {
    const user = await prisma!.user.create({ data: { email: `${marker}-lock@example.test`, status: 'ACTIVE' } });
    const wallet = await prisma!.wallet.create({ data: { userId: user.id, currency: 'INR', balance: new Prisma.Decimal('500.00') } });
    const result = await prisma!.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>`SELECT id,balance FROM wallets WHERE id=${wallet.id} FOR UPDATE`;
      expect(rows).toHaveLength(1);
      return rows[0].balance.toString();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(result).toBe('500');
  });

  it('enforces unique provider transaction IDs', async () => {
    const user = await prisma!.user.create({ data: { email: `${marker}-unique@example.test`, status: 'ACTIVE' } });
    const wallet = await prisma!.wallet.create({ data: { userId: user.id, currency: 'INR' } });
    await prisma!.providerTransaction.create({
      data: { provider: 'phase4', providerTransactionId: `${marker}-call`, userId: user.id, walletId: wallet.id, type: 'DEBIT', amount: 1, currency: 'INR' }
    });
    await expect(prisma!.providerTransaction.create({
      data: { provider: 'phase4', providerTransactionId: `${marker}-call`, userId: user.id, walletId: wallet.id, type: 'DEBIT', amount: 1, currency: 'INR' }
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cleans up its test records', async () => {
    const users = await prisma!.user.findMany({ where: { email: { contains: marker } }, select: { id: true } });
    if (users.length) await prisma!.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });
});
