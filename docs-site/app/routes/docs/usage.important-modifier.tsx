import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/important-modifier.mdx'
import { ImportantModifierPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/important-modifier' })

export default ImportantModifierPage
