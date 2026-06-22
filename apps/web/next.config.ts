import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pleno-crm/types"],
  images: {
    remotePatterns: [
      { hostname: "*.meucuidadoessencial.com.br" },
      { hostname: "*.cdninstagram.com" },
      { hostname: "*.fbcdn.net" },
    ],
  },
};

export default nextConfig;
