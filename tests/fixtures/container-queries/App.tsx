import { tw } from 'typewind-v4';

export default function App() {
  return (
    <div className={tw.$container}>
      <div className={tw.$lg(tw.underline)}>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Animi, non.
      </div>
    </div>
  );
}
