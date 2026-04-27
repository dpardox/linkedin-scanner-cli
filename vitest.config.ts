import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@apps': path.resolve(rootDir, 'src/apps'),
      '@skills': path.resolve(rootDir, 'src/skills'),
      '@keywords': path.resolve(rootDir, 'src/config/keywords'),
      '@config': path.resolve(rootDir, 'src/config'),
      '@models': path.resolve(rootDir, 'src/core/models'),
      '@repository': path.resolve(rootDir, 'src/core/repository'),
      '@core': path.resolve(rootDir, 'src/core'),
      '@infrastructure': path.resolve(rootDir, 'src/infrastructure'),
      '@ports': path.resolve(rootDir, 'src/ports'),
      '@adapters': path.resolve(rootDir, 'src/adapters'),
      '@tui': path.resolve(rootDir, 'src/tui'),
      '@enums': path.resolve(rootDir, 'src/shared/enums'),
      '@utils': path.resolve(rootDir, 'src/shared/utils'),
      '@shared': path.resolve(rootDir, 'src/shared'),
      'config.scanner': path.resolve(rootDir, 'config.scanner.ts'),
      src: path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
  },
});
