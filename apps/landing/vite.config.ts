import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    server: {
        port: 5175,
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                root: resolve(__dirname, 'index.html'),
                en: resolve(__dirname, 'en/index.html'),
                zh: resolve(__dirname, 'zh/index.html'),
            },
        },
    },
});
