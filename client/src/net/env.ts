/** Build-time switches (client/.env*). Node test scripts have no import.meta.env, hence the fallback. */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

export const API_ENABLED = env.VITE_API_ENABLED === 'true';
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID ?? '';
