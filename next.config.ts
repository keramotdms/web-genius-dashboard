import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Vercel-ready: standalone output is not needed on Vercel */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide the Next.js dev-mode badge ("N" circle) that overlaps page content
  devIndicators: false,
};

export default nextConfig;
