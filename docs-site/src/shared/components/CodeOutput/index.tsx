import { ReactNode } from 'react'
import { tw } from 'typewind-v4'

export type CodeOutputProps = {
  children: ReactNode
}

export default function CodeOutput({ children }: CodeOutputProps) {
  return <div className={tw.flex.justify_center.rounded_xl.bg_slate_800.py_5}>{children}</div>
}
