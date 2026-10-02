import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/advanced/escape-hatch.mdx'
import { EscapeHatchPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/advanced/escape-hatch' })

export default EscapeHatchPage
