import { describe, expect, it } from 'vitest';
import { WalletModel } from './financial-engine.js';

describe('concurrency invariant model', () => {
  it('cannot approve more value than the available balance', async () => {
    const w = new WalletModel(500);
    const requests = Array.from({ length: 10 }, (_, i) => Promise.resolve().then(() => {
      try { return w.debit(`bet-${i}`, 100); }
      catch { return { failed: true, balance: w.balance }; }
    }));

    const results = await Promise.all(requests);
    const successful = results.filter(r => !('failed' in r)).length;
    expect(successful).toBe(5);
    expect(w.balance).toBe(0);
  });
});
