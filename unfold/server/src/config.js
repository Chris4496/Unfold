import 'dotenv/config';

/**
 * Central configuration. All values come from the server environment only.
 * The MOONSHOT_API_KEY must never be shipped to the Expo client or
 * worker-web; only this server may call the Moonshot API.
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8787),
    dbPath: env.DB_PATH || './unfold.db',
    jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
    moonshotApiKey: env.MOONSHOT_API_KEY || '',
    moonshotBaseUrl: env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1',
    genaiModel: env.GENAI_MODEL || 'kimi-k3',
    unclaimedTimeoutHours: Number(env.UNCLAIMED_TIMEOUT_HOURS || 72),
    responseTimeoutHours: Number(env.RESPONSE_TIMEOUT_HOURS || 48),
  };
}

export const config = loadConfig();
