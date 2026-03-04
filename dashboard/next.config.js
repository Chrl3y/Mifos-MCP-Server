/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy MCP webhook server in dev
  async rewrites() {
    return [
      { source: "/api/mcp/:path*", destination: "http://localhost:4000/api/mcp/:path*" },
      { source: "/api/events",     destination: "http://localhost:4000/api/events" },
      { source: "/api/health",     destination: "http://localhost:4000/api/health" },
    ];
  },
};

module.exports = nextConfig;
