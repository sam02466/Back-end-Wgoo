import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSession, listUserSessions } from "./session.service.js";

export async function sessionRoutes(app: FastifyInstance) {
  app.get("/api/game-sessions", { preHandler: app.authenticate }, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
    return { success: true, sessions: await listUserSessions(req.user.sub, q.limit) };
  });
  app.get("/api/game-sessions/:sessionId", { preHandler: app.authenticate }, async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params);
    return { success: true, session: await getSession(req.user.sub, sessionId) };
  });
}
