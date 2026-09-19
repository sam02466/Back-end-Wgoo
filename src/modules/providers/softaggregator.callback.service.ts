import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../utils/errors.js";
import { ensureWallet } from "../wallet/wallet.service.js";
import { findProviderTransaction, processProviderMutation } from "../provider-transactions/provider.service.js";

export type SoftWalletCallback = {
  username?: string;
  currency?: string;
  action?: string;
  amount?: string;
  type?: string;
  round_id?: string;
  game_id?: string;
  call_id?: string;
  timestamp?: string;
  key?: string;
  rb?: string;
};

function configuredSalt() {
  if (!env.SOFTAGGREGATOR_ENABLED || !env.SOFTAGGREGATOR_SALT_KEY) {
    throw new AppError("PROVIDER_CONFIG_MISSING", "SoftAggregator callback credentials are not configured", 503);
  }
  return env.SOFTAGGREGATOR_SALT_KEY;
}

export function verifySoftAggregatorSignature(timestamp: string, key: string) {
  const salt = configuredSalt();
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNumber) > 30) return false;
  const expected = crypto.createHash("md5").update(timestamp + salt).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(key, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function centsToRupees(cents: string) {
  if (!/^\d+(\.\d+)?$/.test(cents)) throw new AppError("INVALID_PROVIDER_AMOUNT", "Invalid provider amount", 400);
  const value = new Prisma.Decimal(cents);
  if (!value.isInteger() || value.lt(0)) throw new AppError("INVALID_PROVIDER_AMOUNT", "Provider amount must be a non-negative integer number of minor units", 400);
  return value.div(100);
}

function rupeesToCents(value: Prisma.Decimal) {
  const cents = value.mul(100);
  if (!cents.isInteger()) throw new AppError("INVALID_CURRENCY_SCALE", "Wallet balance has more than two decimal places", 500);
  return Number(cents.toString());
}

async function currentBalanceCents(userId: string, currency: string) {
  const wallet = await ensureWallet(userId, currency);
  return rupeesToCents(new Prisma.Decimal(wallet.balance));
}

export async function handleSoftAggregatorCallback(q: SoftWalletCallback) {
  const { username, currency, action, amount, call_id, timestamp, key } = q;
  if (!username || !currency || !action || !call_id || !timestamp || !key) {
    throw new AppError("CALLBACK_INVALID", "Missing required callback fields", 400);
  }

  if (!verifySoftAggregatorSignature(timestamp, key)) return { error: 2, balance: 0 };

  const user = await prisma.user.findUnique({ where: { id: username }, select: { id: true, status: true } });
  if (!user) return { error: 2, balance: 0 };

  if (action === "balance") {
    return { error: 0, balance: await currentBalanceCents(user.id, currency) };
  }

  if (action !== "debit" && action !== "credit") {
    return { error: 2, balance: await currentBalanceCents(user.id, currency) };
  }

  if (!amount || !/^\d+$/.test(amount) || amount === "0") {
    return { error: 2, balance: await currentBalanceCents(user.id, currency) };
  }

  const existing = await findProviderTransaction("softaggregator", call_id);
  if (existing) return { error: 0, balance: await currentBalanceCents(user.id, currency) };

  if (user.status !== "ACTIVE") return { error: 2, balance: await currentBalanceCents(user.id, currency) };

  const amountMajor = centsToRupees(amount);
  const isRollbackFlagged = q.rb === "1";

  try {
    await processProviderMutation({
      provider: "softaggregator",
      providerTransactionId: call_id,
      providerRoundId: q.round_id,
      userId: user.id,
      currency,
      amount: amountMajor,
      type: action === "debit" ? "DEBIT" : "CREDIT",
      requestPayload: {
        ...q,
        rollbackFlag: isRollbackFlagged,
      },
    });
  } catch (e) {
    const balance = await currentBalanceCents(user.id, currency);
    if (e instanceof AppError && e.code === "INSUFFICIENT_FUNDS") return { error: 1, balance };
    return { error: 2, balance };
  }

  return { error: 0, balance: await currentBalanceCents(user.id, currency) };
}
