import type { Config } from '@react-router/dev/config'

import routes from './app/routes'
import { flattenRoutes } from './src/utils/routes'

export default {
  ssr: false,
  async prerender() {
    return [...new Set(flattenRoutes(routes))]
  }
} satisfies Config
