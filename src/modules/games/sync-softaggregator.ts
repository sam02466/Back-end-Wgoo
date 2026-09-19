import { prisma } from "../../database/prisma.js";
import { getProviderAdapter } from "../../providers/registry.js";

const adapter = getProviderAdapter("softaggregator");
const games = await adapter.getGames();
for (const game of games) {
  await prisma.game.upsert({
    where: { provider_providerGameId: { provider: "softaggregator", providerGameId: game.providerGameId } },
    create: {
      provider: "softaggregator", providerGameId: game.providerGameId, name: game.name,
      category: game.category, thumbnail: game.thumbnail, metadata: game.metadata,
    },
    update: {
      name: game.name, category: game.category, thumbnail: game.thumbnail,
      metadata: game.metadata, status: "ACTIVE",
    },
  });
}
console.log(`Synced ${games.length} SoftAggregator games.`);
await prisma.$disconnect();
