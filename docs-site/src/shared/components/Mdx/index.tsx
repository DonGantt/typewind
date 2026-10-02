import { Children, ReactNode, useState } from 'react'
import { tw } from 'typewind-v4'

import { classNames } from 'utils/index'

const CALLOUT_STYLES = {
  info: tw.border_blue_500.bg_blue_950,
  warning: tw.border_yellow_500.bg_yellow_950,
  error: tw.border_red_500.bg_red_950
} as const

export type CalloutProps = {
  type?: keyof typeof CALLOUT_STYLES
  emoji?: string
  children: ReactNode
}

export function Callout({ type = 'info', emoji = 'ℹ️', children }: CalloutProps) {
  return (
    <div className={classNames(tw.flex.gap_3.rounded_lg.border.px_4.py_3.my_4, CALLOUT_STYLES[type])}>
      <span>{emoji}</span>
      <div className={tw.text_sm}>{children}</div>
    </div>
  )
}

export type TabsProps = {
  items: string[]
  children: ReactNode
}

export function Tabs({ items, children }: TabsProps) {
  const [active, setActive] = useState(0)
  const tabs = Children.toArray(children)

  return (
    <div className={tw.my_4}>
      <div className={tw.flex.gap_2.border_b.border_gray_800}>
        {items.map((item, i) => (
          <button
            key={item}
            type="button"
            onClick={() => setActive(i)}
            className={
              i === active
                ? tw.border_b_2.border_white.px_3.py_2.text_sm.font_medium.text_white
                : tw.border_b_2.border_transparent.px_3.py_2.text_sm.text_gray_400.hover(tw.text_white)
            }
          >
            {item}
          </button>
        ))}
      </div>
      <div className={tw.pt_4}>{tabs[active]}</div>
    </div>
  )
}

export type TabProps = {
  children: ReactNode
}

export function Tab({ children }: TabProps) {
  return <>{children}</>
}

export type CardsProps = {
  children: ReactNode
}

export function Cards({ children }: CardsProps) {
  return <div className={tw.grid.grid_cols_2.gap_4.my_4}>{children}</div>
}

export type CardProps = {
  icon: ReactNode
  title: string
  href: string
}

export function Card({ icon, title, href }: CardProps) {
  return (
    <a
      href={href}
      className={tw.flex.items_center.gap_3.rounded_lg.border.border_gray_800.p_4.no_underline.hover(tw.border_gray_600)}
    >
      <span className={tw.text_gray_300}>{icon}</span>
      <span className={tw.text_white}>{title}</span>
    </a>
  )
}

export type StepsProps = {
  children: ReactNode
}

export function Steps({ children }: StepsProps) {
  const steps = Children.toArray(children)
  return (
    <ol className={tw.my_4.space_y_6}>
      {steps.map((step, i) => (
        <li key={i} className={tw.flex.gap_4}>
          <span
            className={tw.flex.h_8.w_8.shrink_0.items_center.justify_center.rounded_full.bg_gray_800.text_sm.font_bold}
          >
            {i + 1}
          </span>
          <div className={tw.flex_1}>{step}</div>
        </li>
      ))}
    </ol>
  )
}
