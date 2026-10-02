import { MetaFunction } from 'react-router'

import { HomePage } from 'pages/public'
import { buildMeta } from 'utils/seo'

export const meta: MetaFunction = () => buildMeta({ title: 'Home', path: '/', isHome: true })

export default HomePage
