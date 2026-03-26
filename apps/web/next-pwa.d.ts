declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PwaOptions = {
    dest: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    fallbacks?: {
      document?: string;
    };
  };

  const withPWAInit: (options: PwaOptions) => (config: NextConfig) => NextConfig;
  export default withPWAInit;
}
