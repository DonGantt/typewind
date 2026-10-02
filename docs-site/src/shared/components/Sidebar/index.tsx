import { tw } from 'typewind-v4'

import { DOCS_NAV } from 'utils/docs-nav'

export type SidebarProps = {
  currentPath: string
}

export default function Sidebar({ currentPath }: SidebarProps) {
  return (
    <nav className={tw.w_64.shrink_0.overflow_y_auto.border_r.border_gray_800.px_4.py_6}>
      {DOCS_NAV.map((section) => (
        <div key={section.title} className={tw.mb_6}>
          <div className={tw.mb_2.text_xs.font_bold.uppercase.tracking_wide.text_gray_500}>{section.title}</div>
          <ul className={tw.space_y_1}>
            {section.items.map((item) => {
              const isActive = item.path === currentPath
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={
                      isActive
                        ? tw.block.rounded.px_2.py_1.text_sm.bg_gray_800.text_white
                        : tw.block.rounded.px_2.py_1.text_sm.text_gray_400.hover(tw.bg_gray_900.text_white)
                    }
                  >
                    {item.title}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
