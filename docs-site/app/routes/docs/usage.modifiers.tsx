import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/modifiers.mdx'
import { ModifiersPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/modifiers' })

export default ModifiersPage
