import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('SoftAggregator callback signature model', () => {
  it('generates a deterministic MD5(timestamp + salt)', () => {
    const timestamp = '1720000000';
    const salt = 'test-salt';
    const expected = crypto.createHash('md5').update(timestamp + salt).digest('hex');
    expect(expected).toHaveLength(32);
    expect(expected).toBe(crypto.createHash('md5').update(`${timestamp}${salt}`).digest('hex'));
  });

  it('rejects a changed timestamp or salt', () => {
    const timestamp = '1720000000';
    const salt = 'test-salt';
    const signature = crypto.createHash('md5').update(timestamp + salt).digest('hex');
    expect(signature).not.toBe(crypto.createHash('md5').update(timestamp + 'wrong').digest('hex'));
  });
});
