import { useEffect, useRef, useState } from 'react'
import { appleNative } from '../../auth/apple'

export default function AppleButton({ onClick, disabled, loading, className = '' }) {
  const element = useRef(null)
  const [image, setImage] = useState('')
  useEffect(() => {
    let disposed = false
    const resize = new ResizeObserver(async entries => {
      const width = Math.round(entries[0].contentRect.width)
      if (width < 140) return
      try {
        const result = await appleNative.buttonImage({ width })
        if (!disposed && result.image?.startsWith('data:image/png;base64,')) setImage(result.image)
      } catch { /* Keep an accessible text button when the artwork cannot be rendered. */ }
    })
    if (element.current) resize.observe(element.current)
    return () => { disposed = true; resize.disconnect() }
  }, [])
  return <button ref={element} type="button" aria-label="Apple로 계속하기" aria-busy={loading || undefined}
    disabled={disabled || loading} onClick={onClick}
    className={`relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-black text-base font-semibold text-white disabled:opacity-60 ${className}`}>
    {image ? <img src={image} alt="" className="h-12 w-full" /> : <span>Apple로 계속하기</span>}
    {loading && <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black text-sm" role="status">Apple 연결 중…</span>}
  </button>
}
