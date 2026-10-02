import { MetaFunction } from 'react-router'

import { frontmatter } from 'content/docs/index.mdx'
import { IntroductionPage } from 'pages/docs'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () =>
  buildMeta({ title: frontmatter.title, description: frontmatter.description, path: '/docs' })

export default IntroductionPage
