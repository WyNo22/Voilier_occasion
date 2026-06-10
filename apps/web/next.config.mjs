/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@voilierscope/types", "@voilierscope/scrapers"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.leboncoin.fr",
      },
      {
        protocol: "https",
        hostname: "**.bandofboats.com",
      },
      {
        protocol: "https",
        hostname: "**.yachtworld.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
}

export default nextConfig
