import { describe, expect, it } from 'vitest';
import { WalletModel } from './financial-engine.js';

describe('wallet financial invariants', () => {
  it('debits and credits correctly', () => {
    const w = new WalletModel(1000);
    expect(w.debit('bet-1', 100).balance).toBe(900);
    expect(w.credit('win-1', 250).balance).toBe(1150);
  });

  it('never permits a negative balance', () => {
    const w = new WalletModel(100);
    expect(() => w.debit('bet-1', 100.01)).toThrow('INSUFFICIENT_FUNDS');
    expect(w.balance).toBe(100);
  });

  it('is idempotent for duplicate provider transaction IDs', () => {
    const w = new WalletModel(1000);
    expect(w.debit('same-call', 100).balance).toBe(900);
    expect(w.debit('same-call', 100)).toEqual({ idempotent: true, balance: 900 });
    expect(w.balance).toBe(900);
  });

  it('allows credit without a prior debit', () => {
    const w = new WalletModel(0);
    expect(w.credit('free-spin-win', 25).balance).toBe(25);
  });

  it('requires a valid debit as the rollback target', () => {
    const w = new WalletModel(1000);
    expect(() => w.rollback('rb-1', 'missing', 100)).toThrow('ORIGINAL_TRANSACTION_NOT_FOUND');
    w.credit('win-1', 100);
    expect(() => w.rollback('rb-2', 'win-1', 100)).toThrow('INVALID_ROLLBACK_TARGET');
  });

  it('prevents rollback above the original debit', () => {
    const w = new WalletModel(1000);
    w.debit('bet-1', 100);
    expect(() => w.rollback('rb-1', 'bet-1', 101)).toThrow('ROLLBACK_AMOUNT_TOO_LARGE');
    expect(w.balance).toBe(900);
  });

  it('supports a partial rollback without deleting the original bet', () => {
    const w = new WalletModel(1000);
    w.debit('bet-1', 100);
    w.rollback('rb-1', 'bet-1', 40);
    expect(w.balance).toBe(940);
    expect(w.transactions.has('bet-1')).toBe(true);
    expect(w.transactions.get('rb-1')?.originalProviderTxId).toBe('bet-1');
  });
});
