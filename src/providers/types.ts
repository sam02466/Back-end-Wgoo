import { Prisma } from "@prisma/client";

export type ProviderGame = {
  providerGameId: string;
  name: string;
  category: "CRASH"|"INSTANT"|"SLOTS"|"TABLE"|"CARD"|"LIVE_CASINO"|"OTHER";
  thumbnail?: string;
  metadata?: Prisma.InputJsonValue;
};

export type LaunchGameInput = {
  userId: string;
  game: { provider: string; providerGameId: string; name: string };
  sessionId: string;
  currency: string;
  language?: string;
  device?: "desktop" | "mobile";
  country?: string;
  homeUrl?: string;
};

export type LaunchGameResult = {
  providerSessionId?: string;
  launchUrl: string;
  metadata?: Prisma.InputJsonValue;
};

export interface ProviderAdapter {
  readonly name: string;
  getGames(): Promise<ProviderGame[]>;
  launchGame(input: LaunchGameInput): Promise<LaunchGameResult>;
}
