/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/education-files/:path*',
        destination: 'http://localhost:8000/education-files/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
