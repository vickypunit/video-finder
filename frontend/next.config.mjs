/** @type {import('next').NextConfig} */
const nextConfig = {
  // The browser only talks to Next.js; /api/* is proxied to the Node backend.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/:path*` }];
  },
};
export default nextConfig;
