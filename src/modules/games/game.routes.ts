import { FastifyInstance } from "fastify";
import { z } from "zod";
import { GameStatus } from "@prisma/client";
import { getGame, listGames } from "./game.service.js";
import { launchGame } from "../game-sessions/session.service.js";

const querySchema = z.object({
  provider: z.string().optional(), category: z.string().optional(), status: z.nativeEnum(GameStatus).optional(),
  search: z.string().trim().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function gameRoutes(app: FastifyInstance) {
  app.get("/api/games", async (req) => {
    const q = querySchema.parse(req.query);
    return { success: true, ...await listGames(q) };
  });
  app.get("/api/games/:gameId", async (req) => {
    const { gameId } = z.object({ gameId: z.string().uuid() }).parse(req.params);
    return { success: true, game: await getGame(gameId) };
  });
  app.post("/api/games/:gameId/launch", { preHandler: app.authenticate }, async (req) => {
    const { gameId } = z.object({ gameId: z.string().uuid() }).parse(req.params);
    const body = z.object({
      currency: z.string().length(3).default("INR"),
      language: z.string().min(2).max(8).default("en"),
      device: z.enum(["desktop", "mobile"]).default("mobile"),
      country: z.string().length(2).optional(),
      homeUrl: z.string().url().optional(),
    }).parse(req.body ?? {});
    const result = await launchGame({ userId: req.user.sub, gameId, ...body });
    return { success: true, ...result };
  });
}
