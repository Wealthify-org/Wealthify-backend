// proxies.ts
export type ProxyConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export function loadProxiesFromEnv(rawEnv?: string): ProxyConfig[] {
  const raw = rawEnv ?? process.env.CRYPTO_SCRAPER_PROXIES;

  if (!raw) {
    console.warn('[CRYPTO_SCRAPER_PROXIES] env is empty');
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      host: string;
      port: number | string;
      username: string;
      password: string;
    }>;

    return parsed
      .map((p) => ({
        host: p.host,
        port: typeof p.port === 'string' ? Number(p.port) : p.port,
        username: p.username,
        password: p.password,
      }))
      .filter((p) => p.host && p.port && p.username && p.password);
  } catch (e) {
    console.error('[CRYPTO_SCRAPER_PROXIES] Failed to parse:', e);
    return [];
  }
}
