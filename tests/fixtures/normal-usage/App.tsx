import { tw } from 'typewind-v4';
import './index.css';

export default function App() {
  return (
    <div
      className={
        tw.h_screen.w_full.bg_gray_800.flex.justify_center.items_center
      }
    >
      <p className={tw.text_blue_100$['25']}>Hello World!</p>
    </div>
  );
}
