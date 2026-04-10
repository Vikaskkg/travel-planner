/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle the data directory into the serverless functions
  // so RAG JSON files are available at runtime on Vercel
  outputFileTracingIncludes: {
    "/api/generate": ["./data/locations/**/*"],
    "/api/debug":    ["./data/locations/**/*"],
  },
}

module.exports = nextConfig
