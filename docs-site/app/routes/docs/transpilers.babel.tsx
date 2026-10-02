import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/transpilers/babel.mdx'
import { BabelPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/transpilers/babel' })

export default BabelPage
