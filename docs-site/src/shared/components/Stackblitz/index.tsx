import { tw } from 'typewind-v4'

const fileMap = {
  vite: 'src/App.tsx',
  next: 'pages/index.tsx'
} as const

export type StackblitzProps = {
  example: keyof typeof fileMap
}

export default function Stackblitz({ example }: StackblitzProps) {
  return (
    <div className={tw.relative}>
      <iframe
        title={`${example} example`}
        src={`https://stackblitz.com/github/DonGantt/typewind/tree/main/examples/${example}-example?embed=1&file=${fileMap[example]}`}
        className={tw.w_full.h_['71vh'].rounded_lg.border_2.border_['#7977af2b']}
      />
    </div>
  )
}
