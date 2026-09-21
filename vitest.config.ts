import { defineConfig } from 'vitest/config'

// Separado do vite.config.ts porque aquele carrega o plugin do Electron,
// que não tem o que fazer durante os testes. O Vitest prefere este arquivo
// quando ele existe.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
