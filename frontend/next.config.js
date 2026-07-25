/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // BFF proxy route at src/app/api/v1/[...path]/route.ts handles all /api/v1/* requests.
  // No rewrites needed — the route handler attaches the Bearer token server-side.
};

export default nextConfig;
