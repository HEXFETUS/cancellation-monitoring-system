import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Sequential runs so the shared in-memory DB pool isn't trampled
        // across files. Within a file we still rely on backup/restore
        // between tests for isolation.
        pool: "forks",
        // Vitest 4 hoisted poolOptions to top-level fields. Use a single
        // worker process so the shared pg-mem instance is only initialised
        // once per run.
        fileParallelism: false,
        maxWorkers: 1,
        minWorkers: 1,
        include: ["tests/**/*.test.js"],
        environment: "node",
        // 60s ceiling; supertest + pg-mem is fast but CI cold starts vary.
        testTimeout: 30000,
        hookTimeout: 30000,
    },
});
