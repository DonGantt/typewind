import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/usage/container-queries.mdx'
import { ContainerQueriesPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/usage/container-queries' })

export default ContainerQueriesPage
