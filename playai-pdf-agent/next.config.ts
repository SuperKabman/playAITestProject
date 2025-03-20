import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_PLAYAI_API_KEY: process.env.NEXT_PUBLIC_PLAYAI_API_KEY,
    NEXT_PUBLIC_PLAYAI_USER_ID: process.env.NEXT_PUBLIC_PLAYAI_USER_ID,
    NEXT_PUBLIC_PLAYAI_TTS_API_URL: process.env.NEXT_PUBLIC_PLAYAI_TTS_API_URL,
  },
};

module.exports = nextConfig;
