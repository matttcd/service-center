import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import PatternLock from 'pattern-lock-js'

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
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" className="fill-white">
                {seq + 1}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ============================================
// PatternPad: grilla 3x3 interactiva usando pattern-lock-js.
// El library trabaja con enteros 1-indexed (ej: 1456987).
// Convertimos a array 0-indexed (ej: [0,3,5,6,7]) para mantener la API.
// ============================================

const LOCK_SIZE = 180

export default function PatternPad({ value = [], onChange }) {
  const svgRef = useRef(null)
  const lockRef = useRef(null)
  const [currentPattern, setCurrentPattern] = useState([])

  // Convierte entero 1-indexed (pattern-lock-js) a array 0-indexed
  const intToArray = (num) => {
    if (!num || isNaN(num)) return []
    return String(num).split('').map((d) => parseInt(d, 10) - 1).filter((n) => n >= 0 && n < 9)
  }

  // Convierte array 0-indexed a entero 1-indexed (para clear interno)
  const arrayToInt = (arr) => {
    if (!arr.length) return null
    return parseInt(arr.map((n) => n + 1).join(''), 10)
  }

  // Inicializar pattern-lock-js
  useEffect(() => {
    if (!svgRef.current) return

    const lock = new PatternLock(svgRef.current, {
      onPattern(pattern) {
        const arr = intToArray(pattern)
        setCurrentPattern(arr)
        onChange(arr)
        // Devolver true/false para success/error visual del library
        return arr.length >= 3
      },
      vibrate: true,
    })

    lockRef.current = lock

    return () => {
      lockRef.current = null
    }
  }, [])

  // Sincronizar cuando el padre resetea value a []
  useEffect(() => {
    if (!value.length && lockRef.current) {
      lockRef.current.clear()
      setCurrentPattern([])
    }
  }, [value])

  // Limpiar manualmente
  const handleClear = () => {
    if (lockRef.current) lockRef.current.clear()
    setCurrentPattern([])
    onChange([])
  }

  // Quitar último punto
  const handleUndo = () => {
    const next = currentPattern.slice(0, -1)
    setCurrentPattern(next)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1">
      <svg
        ref={svgRef}
        className="patternlock"
        viewBox="0 0 100 100"
        style={{ width: LOCK_SIZE, height: LOCK_SIZE, cursor: 'crosshair', touchAction: 'none' }}
      >
        <g className="lock-actives" />
        <g className="lock-lines" />
        <g className="lock-dots">
          <circle cx="20" cy="20" r="2" />
          <circle cx="50" cy="20" r="2" />
          <circle cx="80" cy="20" r="2" />
          <circle cx="20" cy="50" r="2" />
          <circle cx="50" cy="50" r="2" />
          <circle cx="80" cy="50" r="2" />
          <circle cx="20" cy="80" r="2" />
          <circle cx="50" cy="80" r="2" />
          <circle cx="80" cy="80" r="2" />
        </g>
      </svg>
      <div className="flex items-center justify-start gap-1.5">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!currentPattern.length}
          title="Deshacer último punto"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!currentPattern.length}
          title="Borrar el patrón"
          className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-slate-300 px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Eraser size={12} />
          Limpiar
        </button>
      </div>
    </div>
  )
}
