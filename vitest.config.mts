import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));
const serverOnlyStub = fileURLToPath(
  new URL(
    "./lib/airwallex/tests/server-only.stub.ts",
    import.meta.url,
  ),
);

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
      "server-only": serverOnlyStub,
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/airwallex/tests/**/*.test.ts",
      "__tests__/**/*.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
