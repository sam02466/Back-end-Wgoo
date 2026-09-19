import type { ProviderAdapter } from "./types.js";
import { MockProviderAdapter } from "./mock.adapter.js";
import { SoftAggregatorAdapter } from "./softaggregator.adapter.js";
import { AppError } from "../utils/errors.js";

const adapters: Record<string, ProviderAdapter> = {
  mock: new MockProviderAdapter(),
  softaggregator: new SoftAggregatorAdapter()
};

export function getProviderAdapter(provider: string): ProviderAdapter {
  const adapter = adapters[provider.toLowerCase()];
  if (!adapter) throw new AppError("PROVIDER_UNSUPPORTED", `Unsupported provider: ${provider}`, 400);
  return adapter;
}
