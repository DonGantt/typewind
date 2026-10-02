import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/advanced/configuration.mdx'
import { ConfigurationPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/advanced/configuration' })

export default ConfigurationPage
