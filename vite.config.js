import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
        dts({
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'Gantt',
            fileName: 'gantt',
        },
        rollupOptions: {
            output: {
                format: ['es', 'umd'],
                assetFileNames: 'gantt[extname]',
                entryFileNames: 'gantt.[format].js',
            },
        },
    },
    output: { interop: 'auto' },
});
