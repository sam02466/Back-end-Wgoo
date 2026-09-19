import { GameStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../utils/errors.js";

export async function listGames(input: { provider?: string; category?: string; status?: GameStatus; search?: string; limit: number; offset: number }) {
  const where: Prisma.GameWhereInput = {
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.category ? { category: input.category as any } : {}),
    ...(input.status ? { status: input.status } : { status: GameStatus.ACTIVE }),
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {})
  };
  const [items,total] = await prisma.$transaction([
    prisma.game.findMany({ where, orderBy: { name: "asc" }, take: input.limit, skip: input.offset }),
    prisma.game.count({ where })
  ]);
  return { items, total, limit: input.limit, offset: input.offset };
}

export async function getGame(id: string) {
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) throw new AppError("GAME_NOT_FOUND", "Game not found", 404);
  return game;
}

export async function upsertGame(data: {
  provider: string; providerGameId: string; name: string; category: any; thumbnail?: string; metadata?: Prisma.InputJsonValue;
}) {
  return prisma.game.upsert({
    where: { provider_providerGameId: { provider: data.provider, providerGameId: data.providerGameId } },
    create: data,
    update: { name: data.name, category: data.category, thumbnail: data.thumbnail, metadata: data.metadata }
  });
}
