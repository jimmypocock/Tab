// Redis client placeholder
// In production, this would be a real Redis client
export const redis = {
  get: async (key: string) => null,
  set: async (key: string, value: any, options?: any) => "OK",
  del: async (key: string) => 1,
  expire: async (key: string, seconds: number) => 1,
  incr: async (key: string) => 1,
}
