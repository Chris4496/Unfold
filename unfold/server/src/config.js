import 'dotenv/config';

/**
 * Central configuration. All values come from the server environment only.
 * The GEMINI_API_KEY must never be shipped to the Expo client or
 * worker-web; only this server may call the Gemini API.
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8787),
    dbPath: env.DB_PATH || './unfold.db',
    demoMode: env.DEMO_MODE === '1' && env.NODE_ENV !== 'production',
    jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
    geminiApiKey: env.GEMINI_API_KEY || '',
    geminiBaseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    genaiModel: env.GENAI_MODEL || 'gemini-3.8-flash',
    unclaimedTimeoutHours: Number(env.UNCLAIMED_TIMEOUT_HOURS || 72),
    responseTimeoutHours: Number(env.RESPONSE_TIMEOUT_HOURS || 48),
  };
}

export const config = loadConfig();
