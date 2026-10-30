import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'

export default function WorkPicker({ options, selected, onChange, custom, onCustomChange, inputRef }) {
  const [open, setOpen] = useState(false)
  const inputId = useId()
  const frequent = options.slice(0, 6)
  const toggle = (value) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : selected.length < 8 ? [...selected, value] : selected)
  const add = () => {
    const value = custom.trim()
    if (!value || selected.length >= 8) return
    if (!selected.includes(value)) onChange([...selected, value])
    onCustomChange('')
  }
  return <div className="ws-work-picker">
    <div className="ws-work-choices">{frequent.map((value) => <button type="button" key={value} aria-pressed={selected.includes(value)} className="ws-button" onClick={() => toggle(value)}>{value}</button>)}
      {selected.filter((value) => !frequent.includes(value)).map((value) => <button type="button" className="ws-button" aria-pressed="true" key={value} onClick={() => toggle(value)}>{value}<X size={14} aria-hidden="true" /></button>)}
      <button type="button" className="ws-button" aria-expanded={open || !!custom} aria-controls={inputId} onClick={() => setOpen(true)}><Plus size={14} />Otro</button>
    </div>
    {(open || custom) && <div className="ws-custom-work"><label htmlFor={inputId}>Otro trabajo</label><div><textarea id={inputId} ref={inputRef} value={custom} onChange={(event) => onCustomChange(event.target.value)} /><button type="button" className="ws-button" disabled={!custom.trim() || selected.length >= 8} onClick={add}>Agregar</button></div></div>}
  </div>
}
