/**
 * Provider factory.
 * Reads TIKTOK_PROVIDER env var (default: "tiktool") and returns a singleton.
 *
 * To switch provider: set TIKTOK_PROVIDER=euler (or tiktool) in .env
 */

import { TikToolProvider } from "./TikToolProvider.js";
import { EulerProvider } from "./EulerProvider.js";
import { SessionProvider } from "./SessionProvider.js";

const PROVIDERS = {
	tiktool: TikToolProvider,
	euler: EulerProvider,
	session: SessionProvider,
};

const name = (process.env.TIKTOK_PROVIDER || "tiktool").toLowerCase();
const ProviderClass = PROVIDERS[name];

if (!ProviderClass) {
	const valid = Object.keys(PROVIDERS).join(", ");
	throw new Error(`Unknown TIKTOK_PROVIDER: "${name}". Valid values: ${valid}`);
}

const provider = new ProviderClass();
console.log(`[TikTokProvider] Using provider: ${provider.name}`);

export default provider;
