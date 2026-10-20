import { useNotify } from '../context/notifications.js'
import { useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// ============================================
// PatternPreview: versión de solo lectura (SVG propio, sin dependencia de pattern-lock-js).
// Mantiene el mismo formato: array de enteros 0-8.
// ============================================

const DOT_COORDS = [
  [30, 30], [90, 30], [150, 30],
  [30, 90], [90, 90], [150, 90],
  [30, 150], [90, 150], [150, 150],
]
const PREVIEW_SIZE = 180

export function PatternPreview({ value, size = 120, className = '' }) {
  const pts = (value || []).slice(0, 9).filter((n) => Number.isInteger(n) && n >= 0 && n < 9)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}
      className={`shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
    >
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-primary-600 dark:text-primary-400">
        {pts.slice(1).map((p, i) => {
          const a = DOT_COORDS[pts[i]]
          const b = DOT_COORDS[p]
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
      </g>
      {DOT_COORDS.map(([cx, cy], i) => {
        const seq = pts.indexOf(i)
        const active = seq >= 0
        return (
          <g key={i}>
            <circle
              cx={cx} cy={cy} r="13"
              className={
                active
                  ? 'fill-primary-600 stroke-primary-300 dark:fill-primary-500 dark:stroke-primary-300/60'
                  : 'fill-white stroke-slate-400 dark:fill-slate-800 dark:stroke-slate-500'
              }
              strokeWidth="2.5"
            />
            {active && (
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" style={{ fill: 'var(--pattern-number-fill)' }}>
                {seq + 1}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Selector SVG con Pointer Events: mouse, lápiz y pantalla táctil.
export default function PatternPad({ value = [], onChange, disabled = false }) {
  const drawing = useRef(null)
  const [draft, setDraft] = useState(null)
  const [pointer, setPointer] = useState(null)
  const setError = useNotify('error')
  const points = draft ?? value
  const valid = [...new Set(points.filter((n) => Number.isInteger(n) && n >= 0 && n < 9))]

  const position = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * 180 / rect.width, y: (event.clientY - rect.top) * 180 / rect.height }
  }
  const hit = ({ x, y }) => DOT_COORDS.findIndex(([cx, cy]) => Math.hypot(x - cx, y - cy) < 23)
  const add = (index) => {
    const path = drawing.current
    if (index < 0 || path.includes(index)) return
    if (path.length) {
      const last = path.at(-1)
      const midX = ((last % 3) + (index % 3)) / 2
      const midY = (Math.floor(last / 3) + Math.floor(index / 3)) / 2
      const middle = midY * 3 + midX
      if (Number.isInteger(midX) && Number.isInteger(midY) && !path.includes(middle)) path.push(middle)
    }
    path.push(index)
    setDraft([...path])
  }
  const start = (event) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    const pos = position(event)
    const index = hit(pos)
    if (index < 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = []
    setError('')
    add(index)
    setPointer(pos)
  }
  const move = (event) => {
    if (!drawing.current) return
    const pos = position(event)
    add(hit(pos))
    setPointer(pos)
  }
  const finish = () => {
    if (!drawing.current) return
    const next = [...drawing.current]
    drawing.current = null
    setDraft(null)
    setPointer(null)
    if (next.length < 3) {
      setError('Usá al menos 3 puntos.')
      onChange([])
    } else onChange(next)
  }
  const cancel = () => { drawing.current = null; setDraft(null); setPointer(null) }
  const clear = () => { cancel(); setError(''); onChange([]) }

  return (
    <div className="flex flex-col gap-1">
      <svg width="180" height="180" viewBox="0 0 180 180" aria-label="Patrón de desbloqueo"
        className={`rounded-xl border border-slate-300 dark:border-slate-700 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}>
        <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-primary-600 dark:text-primary-400">
          {valid.slice(1).map((point, i) => <line key={i} x1={DOT_COORDS[valid[i]][0]} y1={DOT_COORDS[valid[i]][1]} x2={DOT_COORDS[point][0]} y2={DOT_COORDS[point][1]} />)}
          {pointer && valid.length > 0 && <line opacity="0.4" x1={DOT_COORDS[valid.at(-1)][0]} y1={DOT_COORDS[valid.at(-1)][1]} x2={pointer.x} y2={pointer.y} />}
        </g>
        {DOT_COORDS.map(([cx, cy], index) => {
          const step = valid.indexOf(index)
          return <g key={index}>
            <circle cx={cx} cy={cy} r="10" className={step >= 0 ? 'fill-primary-600 dark:fill-primary-400' : 'fill-slate-400 dark:fill-slate-500'} />
            {step >= 0 && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">{step + 1}</text>}
          </g>
        })}
      </svg>
      <button type="button" onClick={clear} disabled={!valid.length || disabled}
        className="inline-flex h-7 w-fit items-center gap-1 rounded-full border border-slate-300 px-2 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
        <Eraser size={12} /> Limpiar
      </button>
    </div>
  )
}