export type TxKind = 'BET' | 'WIN' | 'ROLLBACK' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';

export type EngineTx = {
  id: string;
  kind: TxKind;
  amount: number;
  provider?: string;
  providerTxId?: string;
  originalProviderTxId?: string;
};

/**
 * Small deterministic model of the wallet invariants used by the database service.
 * It intentionally contains no Prisma/network code so the most important rules can
 * be tested on every machine, including CI without a database.
 */
export class WalletModel {
  balance: number;
  readonly transactions = new Map<string, EngineTx>();

  constructor(initialBalance = 0) {
    if (!Number.isFinite(initialBalance) || initialBalance < 0) throw new Error('INVALID_INITIAL_BALANCE');
    this.balance = Number(initialBalance.toFixed(2));
  }

  private mutate(kind: TxKind, amount: number, id: string, provider?: string, providerTxId?: string, originalProviderTxId?: string) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
    if (this.transactions.has(id)) return { idempotent: true, balance: this.balance };

    const delta = kind === 'BET' || kind === 'WITHDRAWAL' ? -amount : amount;
    const next = Number((this.balance + delta).toFixed(2));
    if (next < 0) throw new Error('INSUFFICIENT_FUNDS');

    this.transactions.set(id, { id, kind, amount, provider, providerTxId, originalProviderTxId });
    this.balance = next;
    return { idempotent: false, balance: this.balance };
  }

  debit(id: string, amount: number) { return this.mutate('BET', amount, id, 'test', id); }
  credit(id: string, amount: number) { return this.mutate('WIN', amount, id, 'test', id); }
  deposit(id: string, amount: number) { return this.mutate('DEPOSIT', amount, id); }
  withdraw(id: string, amount: number) { return this.mutate('WITHDRAWAL', amount, id); }

  rollback(id: string, originalId: string, amount: number) {
    const original = this.transactions.get(originalId);
    if (!original) throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
    if (original.kind !== 'BET') throw new Error('INVALID_ROLLBACK_TARGET');
    if (amount > original.amount) throw new Error('ROLLBACK_AMOUNT_TOO_LARGE');
    return this.mutate('ROLLBACK', amount, id, 'test', id, originalId);
  }
}
