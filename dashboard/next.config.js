const isPagesDeployment = process.env.BASE_PATH === "/Mifos-MCP-Server";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages
  ...(isPagesDeployment && {
    output: "export",
    basePath: "/Mifos-MCP-Server",
    assetPrefix: "/Mifos-MCP-Server",
    trailingSlash: true,
  }),

  images: {
    unoptimized: true, // required for static export
  },

  // Dev proxy to webhook server (only active when not exporting)
  ...(!isPagesDeployment && {
    async rewrites() {
      return [
        { source: "/api/mcp/:path*",  destination: "http://localhost:4000/api/mcp/:path*" },
        { source: "/api/events",      destination: "http://localhost:4000/api/events" },
        { source: "/api/health",      destination: "http://localhost:4000/api/health" },
      ];
    },
  }),
};

module.exports = nextConfig;
