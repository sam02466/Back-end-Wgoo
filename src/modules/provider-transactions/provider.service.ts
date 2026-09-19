import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { mutateWallet } from "../wallet/wallet.service.js";
import { AppError } from "../../utils/errors.js";

type Args = {
  provider: string; providerTransactionId: string; providerRoundId?: string; userId: string; currency: string;
  amount: Prisma.Decimal; type: "DEBIT" | "CREDIT" | "ROLLBACK";
  requestPayload?: Prisma.InputJsonValue; originalProviderTransactionId?: string;
};

export async function findProviderTransaction(provider: string, id: string) {
  return prisma.providerTransaction.findUnique({ where: { provider_providerTransactionId: { provider, providerTransactionId: id } } });
}

export async function processProviderMutation(a: Args) {
  const existing = await findProviderTransaction(a.provider, a.providerTransactionId);
  if (existing) return { idempotent: true, providerTransaction: existing };

  if (a.type === "ROLLBACK") {
    if (!a.originalProviderTransactionId) throw new AppError("ROLLBACK_ORIGINAL_REQUIRED", "Rollback must reference the original provider transaction", 400);
    const original = await findProviderTransaction(a.provider, a.originalProviderTransactionId);
    if (!original) throw new AppError("ORIGINAL_TRANSACTION_NOT_FOUND", "Original provider transaction not found", 404);
    if (original.type !== "DEBIT") throw new AppError("INVALID_ROLLBACK_TARGET", "Only a debit transaction can be rolled back", 409);
    const alreadyReversed = await prisma.providerTransaction.findFirst({ where: { provider: a.provider, originalProviderTransactionId: a.originalProviderTransactionId, type: "ROLLBACK" } });
    if (alreadyReversed) return { idempotent: true, providerTransaction: alreadyReversed };
    if (a.amount.gt(new Prisma.Decimal(original.amount ?? 0))) throw new AppError("ROLLBACK_AMOUNT_TOO_LARGE", "Rollback amount exceeds original debit", 409);
  }

  const financialType = a.type === "DEBIT" ? "BET" : a.type === "CREDIT" ? "WIN" : "ROLLBACK";
  try {
    const result = await mutateWallet({
      userId: a.userId, currency: a.currency, amount: a.amount, type: financialType,
      reference: `${a.provider}:${a.providerTransactionId}`, metadata: a.requestPayload, provider: a.provider,
      providerTransactionId: a.providerTransactionId, providerRoundId: a.providerRoundId,
      originalProviderTransactionId: a.originalProviderTransactionId, providerType: a.type
    });
    const pt = await prisma.providerTransaction.findUniqueOrThrow({ where: { provider_providerTransactionId: { provider: a.provider, providerTransactionId: a.providerTransactionId } } });
    return { idempotent: false, result, providerTransaction: pt };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await findProviderTransaction(a.provider, a.providerTransactionId);
      if (raced) return { idempotent: true, providerTransaction: raced };
    }
    throw e;
  }
}
