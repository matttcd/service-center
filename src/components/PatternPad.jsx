// ============================================
// PatternPad: grilla 3x3 para dibujar el patrón de desbloqueo.
// - PatternPad: interactivo, arrastrando el dedo/mouse (algoritmo tipo Android:
//   snap a los puntos, se rellenan los puntos intermedios al saltar).
// - PatternPreview: versión de solo lectura (imprimir / mostrar).
// ============================================
import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

const DOTS = [
  [30, 30], [90, 30], [150, 30],
  [30, 90], [90, 90], [150, 90],
  [30, 150], [90, 150], [150, 150],
]
const RADIUS = 22
const SIZE = 180

// Puntos intermedios que se deben completar al saltar de start a end
// (ej: 0 -> 8 agrega el 4 del medio; 2 -> 0 agrega el 1, etc.), como Android.
function getIntermediate(start, end) {
  const [sc, sr] = [start % 3, Math.floor(start / 3)]
  const [ec, er] = [end % 3, Math.floor(end / 3)]
  const dc = Math.abs(ec - sc)
  const dr = Math.abs(er - sr)
  if (dc <= 1 && dr <= 1) return []
  if (dc === 2 && dr === 0) return [sr * 3 + sc + 1]
  if (dc === 0 && dr === 2) return [(sr + 1) * 3 + sc]
  if (dc === 2 && dr === 2) return [4]
  return []
}

function nearestDot(x, y) {
  let best = -1
  let bestDist = RADIUS
  DOTS.forEach(([cx, cy], i) => {
    const d = Math.hypot(x - cx, y - cy)
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  })
  return best
}

function PatternSvg({ value = [], size = 120, live = null, variant = 'preview' }) {
  const pts = (value || []).slice(0, 9).filter((n) => Number.isInteger(n) && n >= 0 && n < 9)
  const last = pts.length ? DOTS[pts[pts.length - 1]] : null

  // Pad interactivo: transparente, se adapta al tema claro/oscuro.
  // Preview: versión clara fija para imprimir / detalle.
  if (variant === 'pad') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700">
        <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" className="text-primary-500 dark:text-primary-400">
          {pts.slice(1).map((p, i) => {
            const a = DOTS[pts[i]]
            const b = DOTS[p]
            return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
          {live && last && <line x1={last[0]} y1={last[1]} x2={live.x} y2={live.y} opacity="0.4" strokeWidth="6" />}
        </g>
        {live && last && (
          <circle cx={live.x} cy={live.y} r="5" fill="currentColor" opacity="0.5" className="text-primary-400" />
        )}
        {DOTS.map(([cx, cy], i) => {
          const active = pts.includes(i)
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
                style={active ? { filter: 'drop-shadow(0 1px 3px rgba(59,130,246,0.45))' } : undefined}
              />
              <text
                x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold"
                className={active ? 'fill-white' : 'fill-slate-400 dark:fill-slate-500'}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 rounded-xl border border-slate-300 bg-white dark:border-slate-700">
      <g stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round">
        {pts.slice(1).map((p, i) => {
          const a = DOTS[pts[i]]
          const b = DOTS[p]
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
        {live && last && <line x1={last[0]} y1={last[1]} x2={live.x} y2={live.y} opacity="0.45" />}
      </g>
      {live && last && (
        <circle cx={live.x} cy={live.y} r="5" fill="#1d4ed8" opacity="0.35" />
      )}
      {DOTS.map(([cx, cy], i) => {
        const active = pts.includes(i)
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="13" fill={active ? '#1d4ed8' : '#fff'} stroke="#1d4ed8" strokeWidth="2.5" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={active ? '#fff' : '#94a3b8'}>
              {i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function PatternPreview({ value, size = 120 }) {
  return <PatternSvg value={value} size={size} />
}

export default function PatternPad({ value = [], onChange }) {
  const svgRef = useRef(null)
  const [progress, setProgress] = useState([])
  const [active, setActive] = useState(false)
  const [live, setLive] = useState(null)

  useEffect(() => {
    // Cuando el padre reinicia el patrón (nueva orden), resetea lo dibujado.
    if (!value.length) {
      setProgress([])
      setLive(null)
      setActive(false)
    }
  }, [value])

  const toSvgPoint = (clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * SIZE,
      y: ((clientY - rect.top) / rect.height) * SIZE,
    }
  }

  const handleDown = (e) => {
    e.preventDefault()
    const pt = toSvgPoint(e.clientX, e.clientY)
    if (!pt) return
    const svg = svgRef.current
    svg?.setPointerCapture?.(e.pointerId)
    setProgress([])
    setActive(true)
    setLive(pt)
    const idx = nearestDot(pt.x, pt.y)
    if (idx >= 0) setProgress([idx])
  }

  const handleMove = (e) => {
    if (!active) return
    e.preventDefault()
    const pt = toSvgPoint(e.clientX, e.clientY)
    if (!pt) return
    setLive(pt)
    const idx = nearestDot(pt.x, pt.y)
    if (idx < 0) return
    setProgress((prev) => {
      if (prev.includes(idx)) return prev
      const intermediates = getIntermediate(prev[prev.length - 1], idx).filter((m) => !prev.includes(m))
      return [...prev, ...intermediates, idx]
    })
  }

  const handleUp = () => {
    if (!active) return
    setActive(false)
    setLive(null)
    const final = progress
    if (final.length) onChange(final.slice())
  }

  const shown = active ? progress : value

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={svgRef}
        className="w-fit cursor-crosshair touch-none select-none"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <PatternSvg value={shown} size={SIZE} live={active ? live : null} variant="pad" />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onChange(shown.slice(0, -1))}
          disabled={!shown.length}
          title="Deshacer último punto"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={!shown.length}
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