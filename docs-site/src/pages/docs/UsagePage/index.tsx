import { DocsLayout } from 'shared/components'

import Content from 'content/docs/usage.mdx'

export default function UsagePage() {
  return (
    <DocsLayout currentPath="/docs/usage">
      <Content />
    </DocsLayout>
  )
}
