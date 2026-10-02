import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/examples/vite.mdx'
import { ViteExamplePage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/examples/vite' })

export default ViteExamplePage
