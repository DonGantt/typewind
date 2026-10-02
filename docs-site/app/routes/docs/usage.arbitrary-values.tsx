import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/arbitrary-values.mdx'
import { ArbitraryValuesPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/arbitrary-values' })

export default ArbitraryValuesPage
