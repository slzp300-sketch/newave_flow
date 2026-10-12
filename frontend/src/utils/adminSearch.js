// Search changes the visible rows only; callers keep totals and mutation targets separate.
export function matchesAdminSearch(search, ...values) {
  const terms = String(search ?? '').normalize('NFKC').trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean)
  const text = values.flat(Infinity).filter(value => value != null).join(' ').normalize('NFKC').toLocaleLowerCase('ko')
  return terms.every(term => text.includes(term))
}

export function paginateAdminRows(rows, page, pageSize = 10) {
  const totalPages = Math.ceil(rows.length / pageSize)
  const currentPage = Math.min(Math.max(0, page), Math.max(0, totalPages - 1))
  return { currentPage, totalPages, items: rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize) }
}
