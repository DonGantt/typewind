import { DocsLayout } from 'shared/components'

import Content from 'content/docs/examples/vite.mdx'

export default function ViteExamplePage() {
  return (
    <DocsLayout currentPath="/docs/examples/vite">
      <Content />
    </DocsLayout>
  )
}
