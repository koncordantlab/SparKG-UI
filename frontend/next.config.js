/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
      {
        source: '/education-files/:path*',
        destination: 'http://127.0.0.1:8000/education-files/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
