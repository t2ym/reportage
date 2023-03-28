import { resolve } from 'path'
import { defineConfig } from 'vite'
import istanbul from 'rollup-plugin-istanbul';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    mode === 'coverage' ? istanbul({
      include: [ 'src/**/*.ts' ],
    }) : undefined,
  ],
  build: {
    rollupOptions: {
      //external: /^lit/,
      input: {
        main: resolve(__dirname, 'index.html'),
        viteNavi: resolve(__dirname, 'external-navi-vite.html'),
        litNavi: resolve(__dirname, 'external-navi-lit.html'),
      },
      plugins: [
        mode === 'coverage' ? istanbul({
          include: [ 'src/**/*.ts' ],
        }) : undefined,
      ]
    },
  },
}))
