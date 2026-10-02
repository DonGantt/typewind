import type { MetaDescriptor } from 'react-router'

import { SITE_NAME, SITE_URL } from './site'

export function buildMeta(options: {
  title: string
  description?: string
  path: string
  isHome?: boolean
}): MetaDescriptor[] {
  const description = options.description || `The safety of TypeScript with the magic of Tailwind CSS v4.`
  const title = options.isHome ? SITE_NAME : `${options.title} – ${SITE_NAME}`
  const url = `${SITE_URL}${options.path}`
  const image = `${SITE_URL}/typewind-share.png`

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { tagName: 'link', rel: 'canonical', href: url }
  ]
}
