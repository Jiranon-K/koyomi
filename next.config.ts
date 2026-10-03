import type { NextConfig } from "next";

import { COVER_HOST } from "./src/features/schedule/cover-host";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: COVER_HOST.protocol,
        hostname: COVER_HOST.hostname,
        port: "",
        pathname: `${COVER_HOST.pathname}**`,
        search: "",
      },
    ],
  },
};

export default nextConfig;
