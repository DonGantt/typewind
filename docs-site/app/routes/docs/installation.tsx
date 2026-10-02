import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/installation.mdx'
import { InstallationPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/installation' })

export default InstallationPage
