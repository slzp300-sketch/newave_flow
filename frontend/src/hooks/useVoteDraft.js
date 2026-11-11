import { useState } from 'react'
import { formSnapshot } from '../utils/unsavedChanges'

export default function useVoteDraft(key, saved, toForm) {
  const [draft, setDraft] = useState(null)
  const active = draft?.key === key ? draft : null
  const value = active?.value || toForm(saved)
  const edit = () => setDraft({ key, value: toForm(saved), baseline: formSnapshot(toForm(saved)) })
  const update = patch => setDraft(previous => {
    const current = previous?.key === key ? previous : { key, value: toForm(saved), baseline: formSnapshot(toForm(saved)) }
    return { ...current, value: { ...current.value, ...patch } }
  })
  const reset = (savedKey = key) => setDraft(previous => previous?.key === savedKey ? null : previous)
  return { value, editing: !!active || !saved?.status, dirty: !!active && formSnapshot(value) !== active.baseline, edit, update, reset }
}
