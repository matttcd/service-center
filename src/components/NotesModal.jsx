// ============================================
// NotesModal: modal dedicado para ver, agregar,
// editar y eliminar notas del técnico.
// ============================================
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Save, StickyNote, Pencil, Trash2, X, Check } from 'lucide-react'
import Modal from './Modal.jsx'
import { formatDate, formatDateTime, sentenceCase } from '../utils/helpers.js'
import ConfirmModal from './ConfirmModal.jsx'

function groupByDay(log) {
  const groups = {}
  for (const entry of log) {
    const day = entry.at?.slice(0, 10) || '—'
    if (!groups[day]) groups[day] = []
    groups[day].push(entry)
  }
  return groups
}

export default function NotesModal({ open, onClose, notesLog = [], isAssignedTech, currentUser, onSave, onEdit, onDelete }) {
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open) { setNoteText(''); setEditingId(null) }
  }, [open])

  const grouped = groupByDay([...notesLog].reverse())
  const days = Object.entries(grouped)

  const handleSave = async () => {
    if (!noteText.trim() || !onSave) return
    setSaving(true)
    await onSave(noteText.trim())
    setSaving(false)
    setNoteText('')
  }

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditText(entry.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async (entryId) => {
    if (!editText.trim() || !onEdit) return
    await onEdit(entryId, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  const handleDelete = async (entryId) => {
    if (onDelete) await onDelete(entryId)
    setConfirmDelete(null)
  }

  const canModify = (entry) => currentUser && (entry.by === currentUser.id || currentUser.role === 'admin')

  return createPortal(
    <Modal open={open} onClose={onClose} title="Notas del técnico" maxWidth="max-w-lg" zIndex="z-[60]">
      <div className="flex flex-col" style={{ minHeight: '300px', maxHeight: '60vh' }}>
        {/* Lista de notas */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {days.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
              <StickyNote size={28} className="opacity-40" />
              <p className="text-sm">Sin notas registradas.</p>
            </div>
          ) : (
            days.map(([day, entries]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {formatDate(day)}
                </p>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                      {editingId === entry.id ? (
                        <div>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <div className="mt-1.5 flex items-center gap-2">
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
                          <p className="text-sm text-slate-700 dark:text-slate-200">{entry.text}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {entry.byName} · {formatDateTime(entry.at)}
                              {entry.editedAt && ' (editada)'}
                            </p>
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
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Agregar nota */}
        {isAssignedTech && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Escribí una nota nueva..."
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !noteText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar nota'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="Eliminar nota"
        message="¿Eliminar esta nota? Esta acción no se puede deshacer."
        danger
      />
    </Modal>,
    document.body
  )
}
