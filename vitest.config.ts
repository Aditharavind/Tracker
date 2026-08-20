import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only the game logic uses vitest. The API and engine suites under tests/
    // run on node:test (`npm run test:api`) -- vitest cannot collect those and
    // would report them as empty failures if it globbed the whole repo.
    include: ["src/**/*.test.ts"],
  },
});
