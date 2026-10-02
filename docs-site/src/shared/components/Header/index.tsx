import { tw } from 'typewind-v4'

export default function Header() {
  return (
    <header className={tw.flex.items_center.justify_between.border_b.border_gray_800.px_6.py_4}>
      <a href="/" className={tw.inline_flex.items_center.select_none} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
        <span className={tw.text_lg.font_extrabold}>type</span>
        <span className={tw.text_lg.font_extrabold.underline.decoration_wavy.decoration_red_500.underline_offset_4}>
          wind
        </span>
      </a>
      <a
        href="https://github.com/DonGantt/typewind"
        target="_blank"
        rel="noreferrer"
        className={tw.text_sm.text_gray_300.hover(tw.text_white)}
      >
        GitHub
      </a>
    </header>
  )
}
