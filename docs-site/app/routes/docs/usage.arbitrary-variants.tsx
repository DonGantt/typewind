import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/arbitrary-variants.mdx'
import { ArbitraryVariantsPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/arbitrary-variants' })

export default ArbitraryVariantsPage
