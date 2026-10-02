import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/examples/next.mdx'
import { NextExamplePage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/examples/next' })

export default NextExamplePage
