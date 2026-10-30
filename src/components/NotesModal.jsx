import { useLayoutEffect, useRef, useState } from 'react'
import { Save, Pencil, Trash2, UserRound } from 'lucide-react'
import { useFormDraft } from '../utils/useFormDraft.js'
import { useNotify } from '../context/notifications.js'
import { formatDateTime, groupNotes } from '../utils/helpers.js'
import Modal from './Modal.jsx'
import ConfirmModal from './ConfirmModal.jsx'

export default function NotesModal({ open, onClose, notesLog = [], isAssignedTech, currentUser, onSave, onEdit, onDelete, draft, onDraftChange }) {
  const [fields, patchFields] = useFormDraft({ noteText: '', editingId: null, editText: '' }, draft, onDraftChange)
  const { noteText, editingId, editText } = fields
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const notifyError = useNotify('error')
  const history = useRef(null)
  const following = useRef(true)
  const wasOpen = useRef(false)
  const lastNote = notesLog.at(-1)?.id
  useLayoutEffect(() => {
    if (open && history.current && (!wasOpen.current || following.current)) history.current.scrollTop = history.current.scrollHeight
    wasOpen.current = open
  }, [open, lastNote])
  const close = () => { if (!busy.current) onClose() }
  const perform = async (operation, done) => {
    if (busy.current) return
    busy.current = true; setSaving(true)
    try { const result = await operation(); if (!result?.error) done() }
    catch (error) { notifyError(error.message) }
    finally { busy.current = false; setSaving(false) }
  }
  const save = (event) => {
    event.preventDefault()
    if (noteText.trim() && onSave) perform(() => onSave(noteText.trim()), () => {
      patchFields({ noteText: '' }); following.current = true
      requestAnimationFrame(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight })
    })
  }
  const saveEdit = (event, entryId) => {
    event.preventDefault()
    if (editText.trim() && onEdit) perform(() => onEdit(entryId, editText.trim()), () => patchFields({ editingId: null, editText: '' }))
  }
  const canModify = (entry) => currentUser && (entry.by === currentUser.id || currentUser.role === 'admin')
  return <Modal open={open} onClose={close} title="Notas del técnico" maxWidth="max-w-2xl" className="sc-notes-modal" zIndex="z-[60]">
    <div className="sc-notes" aria-busy={saving}>
      <section aria-label="Notas registradas" className="sc-note-history" ref={history} onScroll={(event) => { const node = event.currentTarget; following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40 }}>
        {notesLog.length === 0 ? <p className="sc-secondary sc-notes-empty">Sin notas registradas.</p> : <ol>
          {groupNotes(notesLog).map((group) => <li key={group.entries[0].id} className="sc-note-group">
            <header className="sc-note-author"><UserRound size={16} aria-hidden="true" /><strong>{group.byName || 'Sin autor registrado'}</strong><time dateTime={group.at}>{formatDateTime(group.at)}</time></header>
            <ul>{group.entries.map((entry) => <li key={entry.id} className="sc-note-message" data-note-id={entry.id}>
            {editingId === entry.id ? <form className="ws-form" onSubmit={(event) => saveEdit(event, entry.id)}>
              <label>Editar nota<textarea autoFocus rows={4} value={editText} disabled={saving} onChange={(event) => patchFields({ editText: event.target.value })} /></label>
              <div className="ws-buttons"><button type="button" className="ws-button" disabled={saving} onClick={() => patchFields({ editingId: null, editText: '' })}>Cancelar</button><button className="ws-button primary" disabled={saving || !editText.trim()}><Save size={16} />{saving ? 'Guardando…' : 'Guardar'}</button></div>
            </form> : <><p className="sc-note-text">{entry.text}{entry.editedAt && <span className="sc-secondary"> · Editada</span>}</p>{canModify(entry) && <div className="ws-buttons"><button className="ws-icon-button" aria-label="Editar nota" title="Editar nota" disabled={saving} onClick={() => patchFields({ editingId: entry.id, editText: entry.text })}><Pencil size={16} /></button><button className="ws-icon-button" aria-label="Eliminar nota" title="Eliminar nota" disabled={saving} onClick={() => setConfirmDelete(entry.id)}><Trash2 size={16} /></button></div>}</>}
            </li>)}</ul>
          </li>)}
        </ol>}
      </section>
      {isAssignedTech && !editingId && <form className="ws-form sc-note-compose" onSubmit={save}>
        <label>Nueva nota<textarea rows={2} value={noteText} disabled={saving} onChange={(event) => patchFields({ noteText: event.target.value })} placeholder="Escribí una nota nueva..." /></label>
        <div className="ws-buttons"><button type="submit" className="ws-button primary" disabled={saving || !noteText.trim()}><Save size={16} />{saving ? 'Guardando…' : 'Guardar nota'}</button></div>
      </form>}
    </div>
    <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => perform(() => onDelete(confirmDelete), () => setConfirmDelete(null))} title="Eliminar nota" message="¿Eliminar esta nota?" confirmLabel="Eliminar" danger />
  </Modal>
}
