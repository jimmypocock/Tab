/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase and database connection string from environment
  env: {
    DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  },
  // Enable response compression
  compress: true,
  // Optimize production builds
  poweredByHeader: false,
  // Enable strict mode for better performance
  reactStrictMode: true,
  // Configure allowed origins for development
  experimental: {
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'development' 
        ? ['localhost:1235', '*.ngrok-free.app', '*.ngrok.io']
        : undefined,
    },
  },
  // Configure headers for better caching and security
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      {
        // Cache static assets
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig