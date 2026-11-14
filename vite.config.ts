import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1' },
  build: {
    rolldownOptions: {
      input: [
        fileURLToPath(new URL('./index.html', import.meta.url)),
        fileURLToPath(new URL('./about/index.html', import.meta.url)),
      ],
    },
  },
  plugins: [
    {
      name: 'publication-notices',
      generateBundle() {
        for (const [file, output] of [
          ['LICENSE', 'project-mit.txt'],
          ['THIRD_PARTY_NOTICES.md', 'third-party-notices.txt'],
        ]) {
          this.emitFile({
            type: 'asset',
            fileName: `licenses/${output}`,
            source: readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'),
          });
        }
      },
    },
  ],
});
