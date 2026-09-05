import { tw } from 'typewind-v4';
import './index.css';

export default function App() {
  return (
    <div
      className={
        tw.bg_grey_500.text_gray_100.border_grey.hover(tw.bg_grey_600)
      }
    >
      <p className={tw.text_grey_800$['50']}>Hello World!</p>
      <span className={tw.raw('bg-grey-200 text-gray-900')} />
    </div>
  );
}
