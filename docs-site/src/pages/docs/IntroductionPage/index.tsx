import { DocsLayout } from 'shared/components'

import Content from 'content/docs/index.mdx'

export default function IntroductionPage() {
  return (
    <DocsLayout currentPath="/docs">
      <Content />
    </DocsLayout>
  )
}
