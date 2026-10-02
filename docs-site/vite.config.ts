import path from 'path'

import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { typewindVitePlugin } from 'typewind-v4/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter]
      })
    },
    reactRouter(),
    tsconfigPaths(),
    typewindVitePlugin(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      shared: path.resolve(__dirname, 'src/shared'),
      pages: path.resolve(__dirname, 'src/pages'),
      utils: path.resolve(__dirname, 'src/utils'),
      content: path.resolve(__dirname, 'src/content')
    }
  },
  optimizeDeps: {
    exclude: ['lightningcss']
  },
  server: {
    watch: {
      usePolling: true
    },
    host: '0.0.0.0',
    port: 5173
  }
})
