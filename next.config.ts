import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // As rotas de imagem de prévia leem a Raleway do disco em tempo de execução.
  outputFileTracingIncludes: {
    "/og/**": [
      "./node_modules/@fontsource/raleway/files/raleway-latin-{400,700}-normal.woff",
    ],
  },
  experimental: {
    // Capas de até 10 MB mais o resto do formulário (padrão: 1 MB).
    serverActions: { bodySizeLimit: "11mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
