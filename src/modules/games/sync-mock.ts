import { prisma } from "../../database/prisma.js";
import { getProviderAdapter } from "../../providers/registry.js";

const adapter = getProviderAdapter("mock");
const games = await adapter.getGames();
for (const game of games) {
  await prisma.game.upsert({
    where: { provider_providerGameId: { provider: "mock", providerGameId: game.providerGameId } },
    create: { provider: "mock", providerGameId: game.providerGameId, name: game.name, category: game.category, thumbnail: game.thumbnail, metadata: game.metadata },
    update: { name: game.name, category: game.category, thumbnail: game.thumbnail, metadata: game.metadata }
  });
}
console.log(`Synced ${games.length} mock games.`);
await prisma.$disconnect();
