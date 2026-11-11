import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import Button from './Button'
import { MotionDialog } from '../praise/PraiseMotion'
import { changeState, formSnapshot, leavesScreen } from '../../utils/unsavedChanges'
import useAuthStore from '../../store/authStore'
import './UnsavedChanges.css'

const Context = createContext(null)

// One router blocker for the whole layout, including pages with several editors.
export function UnsavedChangesProvider({ children }) {
  const userId = useAuthStore(s => s.user?.id)
  const entries = useRef(new Map()), bypass = useRef(false), pending = useRef(null)
  const [localPrompt, setLocalPrompt] = useState(false)
  const state = useCallback(() => changeState(entries.current.values()), [])
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) =>
    !!userId && !bypass.current && leavesScreen(currentLocation, nextLocation) && (state().dirty || state().busy), [state, userId]))
  const register = useCallback((id, read) => {
    entries.current.set(id, read)
    return () => entries.current.delete(id)
  }, [])
  const perform = useCallback(action => {
    bypass.current = true
    try { return action() } finally { bypass.current = false }
  }, [])
  const confirm = useCallback(action => {
    if (state().busy) return false
    if (!state().dirty) return perform(action)
    pending.current = action
    setLocalPrompt(true)
    return false
  }, [state, perform])
  useEffect(() => {
    const beforeUnload = event => {
      if (!userId || (!state().dirty && !state().busy)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [state, userId])
  const dismiss = () => {
    pending.current = null
    setLocalPrompt(false)
    if (blocker.state === 'blocked') blocker.reset()
  }
  const discard = () => {
    if (state().busy) return
    const action = pending.current
    pending.current = null
    setLocalPrompt(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else if (action) perform(action)
  }
  const blocked = localPrompt || blocker.state === 'blocked'
  return <Context.Provider value={{ register, confirm, complete: perform, readState: state }}>
    {children}
    {blocked && <MotionDialog className="unsaved-changes-dialog" title={state().busy ? '저장 중이에요' : '작성 중인 내용이 있어요'} onClose={dismiss}
      footer={<><Button onClick={dismiss}>계속 작성</Button>{!state().busy && <Button variant="secondary" onClick={discard}>작성 취소 후 이동</Button>}</>}>
      <p className="text-sm text-gray-600">{state().busy ? '저장이 끝난 뒤 이동해 주세요.' : '이동하면 저장하지 않은 내용이 사라져요.'}</p>
    </MotionDialog>}
  </Context.Provider>
}

// Only for navigation that follows an acknowledged save (never for user exits).
export function useAfterSave() {
  return useContext(Context)?.complete || (action => action())
}

export function useHasUnsavedChanges() {
  const context = useContext(Context)
  return () => context?.readState().dirty ?? false
}

export function useUnsavedChanges({ dirty = false, busy = false } = {}) {
  const context = useContext(Context), id = useRef(Symbol()), latest = useRef({ dirty, busy })
  latest.current = { dirty, busy }
  const register = context?.register
  useLayoutEffect(() => register?.(id.current, () => ({ ...latest.current,
    dirty: typeof latest.current.dirty === 'function' ? latest.current.dirty() : latest.current.dirty,
  })), [register])
  return context?.confirm || (action => action())
}

// Capture the values at editor open, not at each background query refresh.
export function useFormChanges(value, { enabled = true, resetKey, busy = false } = {}) {
  const snapshot = formSnapshot(value), baseline = useRef({ snapshot, resetKey, enabled })
  if (!enabled || !baseline.current.enabled || baseline.current.resetKey !== resetKey)
    baseline.current = { snapshot, resetKey, enabled }
  const confirm = useUnsavedChanges({ dirty: () => enabled && snapshot !== baseline.current.snapshot, busy })
  const markSaved = () => { baseline.current = { snapshot, resetKey, enabled } }
  return { confirm, markSaved }
}
