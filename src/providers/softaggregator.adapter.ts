import crypto from "node:crypto";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";
import type { LaunchGameInput, LaunchGameResult, ProviderAdapter, ProviderGame } from "./types.js";

type SAResponse<T> = { error: number; message?: string; response?: T };
type SAGame = {
  id_hash: string; name: string; game_type?: string; provider?: string;
  provider_name?: string; provider_logo?: string; type?: string; category?: string;
  image?: string; freerounds_supported?: boolean; play_for_fun_supported?: boolean;
};

type LaunchResponse = string;

function requireConfig() {
  if (!env.SOFTAGGREGATOR_ENABLED) throw new AppError("PROVIDER_DISABLED", "SoftAggregator integration is disabled", 503);
  if (!env.SOFTAGGREGATOR_API_LOGIN || !env.SOFTAGGREGATOR_API_PASSWORD || !env.SOFTAGGREGATOR_PLAYER_SECRET) {
    throw new AppError("PROVIDER_CONFIG_MISSING", "SoftAggregator credentials are not configured", 503);
  }
}

function playerCredentials(userId: string) {
  requireConfig();
  const username = userId;
  const password = crypto.createHmac("sha256", env.SOFTAGGREGATOR_PLAYER_SECRET!).update(`player:${userId}`).digest("hex");
  return { username, password };
}

function mapCategory(value?: string): ProviderGame["category"] {
  switch ((value ?? "other").toLowerCase()) {
    case "crash": return "CRASH";
    case "instant": return "INSTANT";
    case "slots": return "SLOTS";
    case "table": return "TABLE";
    case "live": return "LIVE_CASINO";
    case "card": return "CARD";
    default: return "OTHER";
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  requireConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.SOFTAGGREGATOR_TIMEOUT_MS);
  try {
    const response = await fetch(env.SOFTAGGREGATOR_BASE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        api_login: env.SOFTAGGREGATOR_API_LOGIN,
        api_password: env.SOFTAGGREGATOR_API_PASSWORD,
        ...body,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AppError("PROVIDER_HTTP_ERROR", `SoftAggregator HTTP ${response.status}`, 502);
    const data = await response.json() as SAResponse<T>;
    if (data.error !== 0) throw new AppError("PROVIDER_API_ERROR", data.message ?? "SoftAggregator rejected the request", 502);
    return data.response as T;
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AppError("PROVIDER_TIMEOUT", "SoftAggregator request timed out", 504);
    throw new AppError("PROVIDER_NETWORK_ERROR", "Could not reach SoftAggregator", 502);
  } finally {
    clearTimeout(timer);
  }
}

export class SoftAggregatorAdapter implements ProviderAdapter {
  readonly name = "softaggregator";

  async getGames(): Promise<ProviderGame[]> {
    const games = await call<SAGame[]>({ method: "getGameList" });
    return games.map(game => ({
      providerGameId: game.id_hash,
      name: game.name,
      category: mapCategory(game.game_type),
      thumbnail: game.image,
      metadata: {
        provider: game.provider,
        providerName: game.provider_name,
        providerLogo: game.provider_logo,
        rawType: game.type,
        rawCategory: game.category,
        freeroundsSupported: game.freerounds_supported ?? false,
        playForFunSupported: game.play_for_fun_supported ?? false,
      },
    }));
  }

  async launchGame(input: LaunchGameInput): Promise<LaunchGameResult> {
    const credentials = playerCredentials(input.userId);

    await call({
      method: "createPlayer",
      user_username: credentials.username,
      user_password: credentials.password,
      currency: input.currency,
    });

    const launchUrl = await call<LaunchResponse>({
      method: "getGame",
      user_username: credentials.username,
      user_password: credentials.password,
      gameid: input.game.providerGameId,
      lang: input.language ?? "en",
      currency: input.currency,
      device: input.device ?? "mobile",
      ...(input.country ? { country: input.country } : {}),
      ...(input.homeUrl ? { homeurl: input.homeUrl } : {}),
    });

    return {
      launchUrl,
      metadata: {
        providerGameId: input.game.providerGameId,
        sessionId: input.sessionId,
        currency: input.currency,
      },
    };
  }
}
