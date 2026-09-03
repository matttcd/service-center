import { useEffect, useRef, useState, useCallback } from 'react'
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

const DOT_COORDS_100 = [
  [20, 20], [50, 20], [80, 20],
  [20, 50], [50, 50], [80, 50],
  [20, 80], [50, 80], [80, 80],
]

function findDotIndex(cx, cy) {
  const x = Number(cx)
  const y = Number(cy)
  for (let i = 0; i < DOT_COORDS_100.length; i++) {
    if (DOT_COORDS_100[i][0] === x && DOT_COORDS_100[i][1] === y) return i
  }
  return -1
}

export default function PatternPad({ value = [], onChange, disabled = false }) {
  const svgRef = useRef(null)
  const lockRef = useRef(null)
  const [currentPattern, setCurrentPattern] = useState([])
  const [activeSteps, setActiveSteps] = useState([])

  const intToArray = useCallback((num) => {
    if (!num || isNaN(num)) return []
    return String(num).split('').map((d) => parseInt(d, 10) - 1).filter((n) => n >= 0 && n < 9)
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    const lock = new PatternLock(svgRef.current, {
      onPattern(pattern) {
        const arr = intToArray(pattern)
        setCurrentPattern(arr)
        onChange(arr)
      },
      vibrate: true,
    })
    lockRef.current = lock

    const activesGroup = svgRef.current.querySelector('g.lock-actives')
    let prevCount = 0

    const observer = new MutationObserver((mutations) => {
      let added = 0
      let removed = 0
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.tagName === 'circle') added++
        }
        for (const n of m.removedNodes) {
          if (n.tagName === 'circle') removed++
        }
      }
      if (added > 0 && removed === 0) {
        const circles = activesGroup.querySelectorAll('circle')
        const last = circles[circles.length - 1]
        if (last) {
          const dotIdx = findDotIndex(last.getAttribute('cx'), last.getAttribute('cy'))
          if (dotIdx >= 0) {
            setActiveSteps((prev) => [...prev, { dotIdx, step: prev.length + 1 }])
          }
        }
      }
      if (removed > 0) {
        setActiveSteps([])
        prevCount = 0
      }
    })

    observer.observe(activesGroup, { childList: true })

    return () => {
      observer.disconnect()
      lockRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!value.length && lockRef.current) {
      lockRef.current.clear()
      setCurrentPattern([])
      setActiveSteps([])
    }
  }, [value])

  const handleClear = () => {
    if (lockRef.current) lockRef.current.clear()
    setCurrentPattern([])
    setActiveSteps([])
    onChange([])
  }

  return (
    <div className="flex flex-col gap-1">
      <div style={{ position: 'relative', width: LOCK_SIZE, height: LOCK_SIZE }}>
        {disabled ? (
          <svg viewBox="0 0 100 100" width={LOCK_SIZE} height={LOCK_SIZE} className="cursor-not-allowed rounded-2xl border border-slate-300 dark:border-slate-700" style={{ touchAction: 'none', opacity: 0.5 }}>
            <g>
              <circle cx="20" cy="20" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="50" cy="20" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="80" cy="20" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="20" cy="50" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="50" cy="50" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="80" cy="50" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="20" cy="80" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="50" cy="80" r="2" className="fill-slate-300 dark:fill-slate-600" />
              <circle cx="80" cy="80" r="2" className="fill-slate-300 dark:fill-slate-600" />
            </g>
          </svg>
        ) : (
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
        )}
        {!disabled && activeSteps.length > 0 && (
          <svg
            viewBox="0 0 100 100"
            width={LOCK_SIZE}
            height={LOCK_SIZE}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            {activeSteps.map(({ dotIdx, step }) => {
              const [cx, cy] = DOT_COORDS_100[dotIdx]
              return (
                <text
                  key={step}
                  x={cx}
                  y={cy - 9}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontWeight="bold"
                  fill="white"
                  stroke="var(--color-primary-700, #1e40af)"
                  strokeWidth="0.5"
                  paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {step}
                </text>
              )
            })}
          </svg>
        )}
      </div>
      <div className="flex items-center justify-start gap-1.5">
        <button
          type="button"
          onClick={handleClear}
          disabled={!currentPattern.length || disabled}
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
