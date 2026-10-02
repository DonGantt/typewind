import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/transpilers/swc.mdx'
import { SwcPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/transpilers/swc' })

export default SwcPage
