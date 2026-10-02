import type { RouteConfig } from '@react-router/dev/routes'

export default [
  { path: '/', file: 'routes/_home.tsx' },
  { path: '/docs', file: 'routes/docs/index.tsx' },
  { path: '/docs/installation', file: 'routes/docs/installation.tsx' },
  { path: '/docs/usage', file: 'routes/docs/usage.tsx' },
  { path: '/docs/usage/normal-usage', file: 'routes/docs/usage.normal-usage.tsx' },
  { path: '/docs/usage/modifiers', file: 'routes/docs/usage.modifiers.tsx' },
  { path: '/docs/usage/important-modifier', file: 'routes/docs/usage.important-modifier.tsx' },
  { path: '/docs/usage/arbitrary-values', file: 'routes/docs/usage.arbitrary-values.tsx' },
  { path: '/docs/usage/arbitrary-variants', file: 'routes/docs/usage.arbitrary-variants.tsx' },
  { path: '/docs/usage/container-queries', file: 'routes/docs/usage.container-queries.tsx' },
  { path: '/docs/transpilers/babel', file: 'routes/docs/transpilers.babel.tsx' },
  { path: '/docs/transpilers/swc', file: 'routes/docs/transpilers.swc.tsx' },
  { path: '/docs/examples/vite', file: 'routes/docs/examples.vite.tsx' },
  { path: '/docs/examples/next', file: 'routes/docs/examples.next.tsx' },
  { path: '/docs/advanced/configuration', file: 'routes/docs/advanced.configuration.tsx' },
  { path: '/docs/advanced/escape-hatch', file: 'routes/docs/advanced.escape-hatch.tsx' },
  { path: '/docs/advanced/custom-config-file-path', file: 'routes/docs/advanced.custom-config-file-path.tsx' },
  { path: '/docs/advanced/rem-to-px', file: 'routes/docs/advanced.rem-to-px.tsx' }
] satisfies RouteConfig
