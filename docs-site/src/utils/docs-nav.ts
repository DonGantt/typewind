export interface NavItem {
  title: string
  path: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const DOCS_NAV: NavSection[] = [
  {
    title: 'Introduction',
    items: [
      { title: 'Introduction', path: '/docs' },
      { title: 'Installation', path: '/docs/installation' }
    ]
  },
  {
    title: 'Usage',
    items: [
      { title: 'Overview', path: '/docs/usage' },
      { title: 'Normal Usage', path: '/docs/usage/normal-usage' },
      { title: 'Modifiers', path: '/docs/usage/modifiers' },
      { title: 'Important Modifier', path: '/docs/usage/important-modifier' },
      { title: 'Arbitrary Values', path: '/docs/usage/arbitrary-values' },
      { title: 'Arbitrary Variants', path: '/docs/usage/arbitrary-variants' },
      { title: 'Container Queries', path: '/docs/usage/container-queries' }
    ]
  },
  {
    title: 'Transpilers',
    items: [
      { title: 'Babel', path: '/docs/transpilers/babel' },
      { title: 'SWC', path: '/docs/transpilers/swc' }
    ]
  },
  {
    title: 'Examples',
    items: [
      { title: 'Vite', path: '/docs/examples/vite' },
      { title: 'NextJS', path: '/docs/examples/next' }
    ]
  },
  {
    title: 'Advanced',
    items: [
      { title: 'Configuration', path: '/docs/advanced/configuration' },
      { title: 'Escape Hatch', path: '/docs/advanced/escape-hatch' },
      { title: 'Custom Config File Path', path: '/docs/advanced/custom-config-file-path' },
      { title: 'Rem to Px', path: '/docs/advanced/rem-to-px' }
    ]
  }
]
