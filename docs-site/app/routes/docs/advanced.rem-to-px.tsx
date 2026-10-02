import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/advanced/rem-to-px.mdx'
import { RemToPxPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/advanced/rem-to-px' })

export default RemToPxPage
