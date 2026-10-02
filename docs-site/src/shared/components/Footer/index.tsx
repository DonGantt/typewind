import { tw } from 'typewind-v4'

export default function Footer() {
  return (
    <footer className={tw.flex.justify_between.gap_4.border_t.border_gray_800.px_6.py_4.text_sm.text_gray_400}>
      <div>
        MIT ©{' '}
        <a href="https://github.com/DonGantt" className={tw.text_gray_300.hover(tw.text_white)}>
          DonGantt
        </a>
      </div>
    </footer>
  )
}
