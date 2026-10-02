import { writeFileSync } from 'fs'

import { SitemapStream, streamToPromise } from 'sitemap'
import { loadEnv } from 'vite'

import routes from '../app/routes'
import { flattenRoutes } from '../src/utils/routes'

async function generateSitemap(siteUrl: string, paths: string[]) {
  const sitemapStream = new SitemapStream({ hostname: siteUrl })

  paths.forEach((path) => {
    sitemapStream.write({ url: path, priority: path === '/' ? 1.0 : 0.7 })
  })

  sitemapStream.end()

  const sitemap = await streamToPromise(sitemapStream).then((sm) => sm.toString())

  writeFileSync('public/sitemap.xml', sitemap)
  console.log('sitemap.xml created:', paths)
}

async function generateRobots(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, '')
  const sitemapUrl = `${base}/sitemap.xml`

  const lines = ['User-agent: *', 'Allow: /', `Host: ${base}`, `Sitemap: ${sitemapUrl}`]

  writeFileSync('public/robots.txt', lines.join('\n') + '\n', { encoding: 'utf8' })
  console.log('public/robots.txt created')
}

async function generateAll() {
  const mode = process.env.NODE_ENV || 'production'
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || process.env.VITE_SITE_URL

  if (!siteUrl) {
    throw new Error('VITE_SITE_URL is required for build time')
  }

  const paths = [...new Set(flattenRoutes(routes))]

  await generateSitemap(siteUrl, paths)
  await generateRobots(siteUrl)
}

generateAll().catch((err) => {
  console.error(err)
  process.exit(1)
})
