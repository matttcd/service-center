// ============================================
// SparePartsModal: modal para ver, agregar,
// editar y eliminar repuestos necesarios.
// ============================================
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Save, Package, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react'
import Modal from './Modal.jsx'
import { formatDateTime } from '../utils/helpers.js'
import ConfirmModal from './ConfirmModal.jsx'

const STATUS_OPTIONS = [
  { value: 'necesario', label: 'Necesario', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  { value: 'pedido', label: 'Pedido', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  { value: 'recibido', label: 'Recibido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
]

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${opt.color}`}>
      {opt.label}
    </span>
  )
}

export default function SparePartsModal({ open, onClose, sparePartsLog = [], isAssignedTech, currentUser, onSave, onEdit, onDelete }) {
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editQty, setEditQty] = useState(1)
  const [editStatus, setEditStatus] = useState('necesario')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open) { setNewName(''); setNewQty(1); setEditingId(null) }
  }, [open])

  const handleSave = async () => {
    if (!newName.trim() || !onSave) return
    setSaving(true)
    await onSave(newName.trim(), newQty)
    setSaving(false)
    setNewName('')
    setNewQty(1)
  }

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditName(entry.name)
    setEditQty(entry.quantity)
    setEditStatus(entry.status)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditQty(1)
    setEditStatus('necesario')
  }

  const saveEdit = async (entryId) => {
    if (!editName.trim() || !onEdit) return
    await onEdit(entryId, { name: editName.trim(), quantity: editQty, status: editStatus })
    setEditingId(null)
  }

  const handleDelete = async (entryId) => {
    if (onDelete) await onDelete(entryId)
    setConfirmDelete(null)
  }

  const canModify = (entry) => currentUser && (entry.by === currentUser.id || currentUser.role === 'admin')

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return createPortal(
    <Modal open={open} onClose={onClose} title="Repuestos necesarios" maxWidth="max-w-lg" zIndex="z-[60]">
      <div className="flex flex-col" style={{ minHeight: '200px', maxHeight: '60vh' }}>
        {/* Lista de repuestos */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sparePartsLog.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
              <Package size={28} className="opacity-40" />
              <p className="text-sm">Sin repuestos registrados.</p>
            </div>
          ) : (
            sparePartsLog.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nombre del repuesto"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={editQty}
                          onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className={inputCls}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => saveEdit(entry.id)} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-primary-700">
                        <Check size={12} /> Guardar
                      </button>
                      <button onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        <X size={12} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{entry.name}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Cant: {entry.quantity} · {entry.byName} · {formatDateTime(entry.at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={entry.status} />
                        {canModify(entry) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(entry)} className="rounded p-0.5 text-slate-400 transition hover:text-primary-600 dark:hover:text-primary-400">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => setConfirmDelete(entry.id)} className="rounded p-0.5 text-slate-400 transition hover:text-red-500 dark:hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Agregar repuesto */}
        {isAssignedTech && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del repuesto"
              className={inputCls}
            />
            <div className="mt-2 flex gap-2">
              <div className="w-24">
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={newQty}
                  onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputCls}
                />
              </div>
              <div className="flex-1 flex items-end">
                <button
                  onClick={handleSave}
                  disabled={saving || !newName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="Eliminar repuesto"
        message="¿Eliminar este repuesto? Esta acción no se puede deshacer."
        danger
      />
    </Modal>,
    document.body
  )
}
