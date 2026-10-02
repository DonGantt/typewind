import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/advanced/custom-config-file-path.mdx'
import { CustomConfigFilePathPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs/advanced/custom-config-file-path' })

export default CustomConfigFilePathPage
