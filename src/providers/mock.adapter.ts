import type { LaunchGameInput, LaunchGameResult, ProviderAdapter, ProviderGame } from "./types.js";

export class MockProviderAdapter implements ProviderAdapter {
  readonly name = "mock";

  async getGames(): Promise<ProviderGame[]> {
    return [
      { providerGameId: "demo-crash", name: "Demo Crash", category: "CRASH", metadata: { sandbox: true } },
      { providerGameId: "demo-slots", name: "Demo Slots", category: "SLOTS", metadata: { sandbox: true } }
    ];
  }

  async launchGame(input: LaunchGameInput): Promise<LaunchGameResult> {
    return {
      providerSessionId: `mock-${input.sessionId}`,
      launchUrl: `/mock-games/${encodeURIComponent(input.game.providerGameId)}?sessionId=${encodeURIComponent(input.sessionId)}`,
      metadata: { sandbox: true }
    };
  }
}
