import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  // Sem isto o Electron carregando por file:// não acha os assets.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    electron({
      // Sai em ESM, como dist-electron/main.js. O Electron 28+ aceita ESM
      // no processo principal, com import nomeado de 'electron'.
      main: { entry: 'electron/main.ts' },
      // O preload sai em CommonJS de propósito. Preload em ESM só funciona
      // com sandbox desligado, e desligar o sandbox por causa de um nome de
      // arquivo é um mau negócio.
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: { output: { format: 'cjs', entryFileNames: 'preload.cjs' } },
          },
        },
      },
    }),
  ],
})
