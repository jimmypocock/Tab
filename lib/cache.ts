// Simple cache utility for Redis caching
export const withRedisCache = async <T>(
  _key: string,
  _ttl: number,
  fn: () => Promise<T>
): Promise<T> => {
  // In production, this would check Redis first
  // For now, just execute the function
  return fn()
}

export const CacheKeys = {
  apiKey: (hash: string) => `api_key:${hash}`,
  merchant: (id: string) => `merchant:${id}`,
  tab: (id: string) => `tab:${id}`,
  dashboardStats: (id: string) => `dashboard:${id}`,
}