import { FastifyInstance } from "fastify";
import { handleSoftAggregatorCallback } from "./softaggregator.callback.service.js";

export async function softAggregatorRoutes(app: FastifyInstance) {
  // SoftAggregator requires HTTP 200 for callback processing errors; the JSON error code
  // communicates success/insufficient balance/processing error to the provider.
  app.get("/api/providers/softaggregator/wallet", async (req, reply) => {
    try {
      const result = await handleSoftAggregatorCallback(req.query as Record<string, string | undefined>);
      return reply.code(200).send(result);
    } catch (error) {
      req.log.error(error);
      return reply.code(200).send({ error: 2, balance: 0 });
    }
  });
}
