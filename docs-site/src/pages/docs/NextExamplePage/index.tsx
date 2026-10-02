import { DocsLayout } from 'shared/components'

import Content from 'content/docs/examples/next.mdx'

export default function NextExamplePage() {
  return (
    <DocsLayout currentPath="/docs/examples/next">
      <Content />
    </DocsLayout>
  )
}
