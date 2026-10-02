export interface RouteEntry {
  path?: string
  children?: RouteEntry[]
}

export function flattenRoutes(entries: RouteEntry[], basePath = ''): string[] {
  return entries.flatMap((entry) => {
    const paths: string[] = []

    if (entry.path) {
      let fullPath =
        entry.path.startsWith('/') || basePath === ''
          ? entry.path
          : `${basePath.replace(/\/$/, '')}/${entry.path.replace(/^\//, '')}`

      if (fullPath !== '/' && fullPath.endsWith('/')) {
        fullPath = fullPath.slice(0, -1)
      }

      if (!fullPath.includes(':')) {
        paths.push(fullPath)
      }

      if (entry.children) {
        paths.push(...flattenRoutes(entry.children, fullPath))
      }
    } else if (entry.children) {
      paths.push(...flattenRoutes(entry.children, basePath))
    }

    return paths
  })
}
