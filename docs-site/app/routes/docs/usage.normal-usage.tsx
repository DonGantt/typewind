import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/normal-usage.mdx'
import { NormalUsagePage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/normal-usage' })

export default NormalUsagePage
