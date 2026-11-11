const inPath = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)

export function navigationSection(pathname) {
  if (pathname === '/') return '/'
  if (['/calendar', '/events'].some(p => inPath(pathname, p))) return '/calendar'
  if (['/profile', '/safety/report', '/community-guidelines'].some(p => inPath(pathname, p))) return '/profile'
  return '/'
}

export function parentPath(pathname) {
  if (pathname === '/privacy') return '/login'
  if (inPath(pathname, '/students')) return '/roster'
  if (pathname.startsWith('/event-attendance/')) return '/event-attendance'
  if (pathname.startsWith('/admin/')) return '/admin'
  const section = navigationSection(pathname)
  return section === pathname ? '/' : section
}

export function filterMenuGroups(groups, search, scope = 'all') {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return groups.filter(g => scope === 'all' || (scope === 'admin' ? g.admin : !g.admin))
    .map(g => ({ ...g, items: g.items.filter(item => {
      const text = `${g.title} ${item.title} ${item.desc || ''}`.toLocaleLowerCase()
      return terms.every(term => text.includes(term))
    }) })).filter(g => g.items.length)
}
