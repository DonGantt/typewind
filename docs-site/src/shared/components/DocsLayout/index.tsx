import { ReactNode } from 'react'
import { tw } from 'typewind-v4'

import { Footer, Header, Sidebar } from 'shared/components'

export type DocsLayoutProps = {
  children: ReactNode
  currentPath: string
}

export default function DocsLayout({ children, currentPath }: DocsLayoutProps) {
  return (
    <div className={tw.flex.min_h_screen.flex_col}>
      <Header />
      <div className={tw.flex.flex_1}>
        <Sidebar currentPath={currentPath} />
        <main className={tw.prose.prose_invert.max_w_none.flex_1.px_8.py_8}>{children}</main>
      </div>
      <Footer />
    </div>
  )
}
