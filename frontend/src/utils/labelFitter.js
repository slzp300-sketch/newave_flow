// One observer/scheduler for a screen's labels. Measure all labels, then write
// all sizes together so fitting N labels does not force N separate layout loops.
export function createLabelFitter(view) {
  const doc = view.document, entries = new Map(), queued = new Set()
  let frame = 0, observer, mutation, generation = 0
  const schedule = el => {
    if (entries.has(el)) queued.add(el)
    if (!frame && queued.size) frame = view.requestAnimationFrame(flush)
  }
  const all = () => { for (const el of entries.keys()) schedule(el) }
  const fonts = () => { for (const entry of entries.values()) entry.last = ''; all() }
  const transition = event => {
    if (event.target === doc.documentElement && event.propertyName === 'font-size') all()
  }
  function flush() {
    frame = 0
    const rootSize = parseFloat(view.getComputedStyle(doc.documentElement).fontSize)
    const measured = []
    for (const el of queued) {
      const entry = entries.get(el)
      if (!entry || !el.isConnected) continue
      const width = el.getBoundingClientRect().width
      if (!width) continue
      const base = parseFloat(view.getComputedStyle(el.parentElement).fontSize)
      const signature = `${width}:${base}:${rootSize}:${el.textContent}`
      if (signature === entry.last || !Number.isFinite(base) || !Number.isFinite(rootSize)) continue
      entry.last = signature
      measured.push({ el, size: base, floor: Math.min(base, Math.max(rootSize * .875, base * .85)), maxLines: entry.maxLines })
    }
    queued.clear()
    for (const item of measured) item.el.style.fontSize = `${item.size}px`
    let pending = measured
    while (pending.length) {
      // No writes while inspecting dimensions; the browser can share layout.
      const shrink = pending.filter(({ el, size, floor, maxLines }) => size > floor &&
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > size * 1.4 * maxLines + 1))
      for (const item of shrink) {
        item.size = Math.max(item.floor, item.size - .5)
        item.el.style.fontSize = `${item.size}px`
      }
      pending = shrink
    }
  }
  const start = () => {
    const current = ++generation
    observer = new view.ResizeObserver(changes => { for (const change of changes) schedule(change.target) })
    mutation = new view.MutationObserver(all)
    mutation.observe(doc.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
    doc.fonts?.ready.then(() => { if (current === generation) fonts() })
    doc.fonts?.addEventListener('loadingdone', fonts)
    doc.documentElement.addEventListener('transitionend', transition)
    view.addEventListener('resize', all)
  }
  return {
    observe(el, maxLines) {
      if (!entries.size) start()
      entries.set(el, { maxLines, last: '' })
      observer.observe(el)
      schedule(el)
      return () => {
        observer.unobserve(el)
        entries.delete(el); queued.delete(el)
        if (entries.size) return
        generation++
        view.cancelAnimationFrame(frame); frame = 0
        observer.disconnect(); mutation.disconnect()
        doc.fonts?.removeEventListener('loadingdone', fonts)
        doc.documentElement.removeEventListener('transitionend', transition)
        view.removeEventListener('resize', all)
      }
    },
  }
}

let shared
export const observeLabel = (el, maxLines) => {
  shared ||= createLabelFitter(window)
  return shared.observe(el, maxLines)
}
