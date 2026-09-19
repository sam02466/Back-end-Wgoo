import { GameSessionStatus, GameStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../utils/errors.js";
import { getProviderAdapter } from "../../providers/registry.js";

export async function launchGame(input: { userId: string; gameId: string; currency: string; language?: string; device?: "desktop" | "mobile"; country?: string; homeUrl?: string }) {
  const game = await prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game) throw new AppError("GAME_NOT_FOUND", "Game not found", 404);
  if (game.status !== GameStatus.ACTIVE) throw new AppError("GAME_NOT_AVAILABLE", "Game is not currently available", 409);
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (user.status !== "ACTIVE") throw new AppError("USER_NOT_ACTIVE", "User is not active", 403);

  const session = await prisma.gameSession.create({ data: {
    userId: input.userId, gameId: game.id, provider: game.provider, status: GameSessionStatus.ACTIVE,
    metadata: { currency: input.currency }
  }});

  try {
    const adapter = getProviderAdapter(game.provider);
    const launch = await adapter.launchGame({
      userId: input.userId,
      game: { provider: game.provider, providerGameId: game.providerGameId, name: game.name },
      sessionId: session.id,
      currency: input.currency, language: input.language, device: input.device, country: input.country, homeUrl: input.homeUrl
    });
    const updated = await prisma.gameSession.update({ where: { id: session.id }, data: {
      providerSessionId: launch.providerSessionId,
      launchUrl: launch.launchUrl,
      metadata: launch.metadata
    }});
    return { sessionId: updated.id, provider: updated.provider, providerSessionId: updated.providerSessionId, launchUrl: updated.launchUrl };
  } catch (e) {
    await prisma.gameSession.update({ where: { id: session.id }, data: { status: GameSessionStatus.CANCELLED } });
    throw e;
  }
}

export async function listUserSessions(userId: string, limit = 30) {
  return prisma.gameSession.findMany({ where: { userId }, include: { game: true }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function getSession(userId: string, id: string) {
  const session = await prisma.gameSession.findFirst({ where: { id, userId }, include: { game: true } });
  if (!session) throw new AppError("SESSION_NOT_FOUND", "Game session not found", 404);
  return session;
}
