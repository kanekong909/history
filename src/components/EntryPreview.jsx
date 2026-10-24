import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { forwardRef, useState } from 'react'
import Block from './EntryBlocks.jsx'
import BlockEditor from './BlockEditor.jsx'
import EntryHeader from './EntryHeader.jsx'

const LABELS = { text: 'Texto', image: 'Imagen', carousel: 'Carrusel', quote: 'Cita', heading: 'Subtítulo' }

// Parte visual del bloque (también se usa en la copia que sigue al dedo/ratón al arrastrar).
const ItemView = forwardRef(function ItemView({ block, index, count, onEdit, onRemove, onMove, overlay, ...rest }, ref) {
  const wide = (block.type === 'image' || block.type === 'carousel') && block.size === 'wide'
  const { className = '', ...props } = rest
  return (
    <div ref={ref} className={`preview-item ${wide ? 'wide' : ''} ${overlay ? 'overlay' : ''} ${className}`} {...props}>
      <div className="preview-tools">
        <span className="grip" title="Arrastra para mover">⠿ {LABELS[block.type]}</span>
        {!overlay && (
          // Los botones no deben iniciar el arrastre
          <span className="preview-buttons" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <button type="button" className="ghost small" disabled={index === 0} onClick={() => onMove(-1)} title="Subir">↑</button>
            <button type="button" className="ghost small" disabled={index === count - 1} onClick={() => onMove(1)} title="Bajar">↓</button>
            <button type="button" className="ghost small" onClick={onEdit} title="Editar aquí mismo">✎</button>
            <button type="button" className="ghost small" onClick={onRemove} title="Eliminar">✕</button>
          </span>
        )}
      </div>
      <div className="preview-body"><Block block={block} /></div>
    </div>
  )
})

function SortableItem({ editing, onChange, onDone, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.block.id, disabled: editing })

  // Editando en el sitio: el bloque se convierte en su editor y no se puede arrastrar hasta pulsar «Listo».
  if (editing) {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="preview-item editing">
        <BlockEditor
          block={props.block}
          onChange={onChange}
          onRemove={props.onRemove}
          onMove={props.onMove}
          isFirst={props.index === 0}
          isLast={props.index === props.count - 1}
          onDone={onDone}
        />
      </div>
    )
  }
  return (
    <ItemView
      {...props}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'dragging' : ''}
      {...attributes}
      {...listeners}
    />
  )
}

export default function EntryPreview({ draft, onReorder, onChangeBlock, onRemoveBlock }) {
  const [activeId, setActiveId] = useState(null)
  const [editingId, setEditingId] = useState(null)

  // Ratón: arrastrar tras mover 6px. Táctil: mantener pulsado 200 ms (así se puede seguir haciendo scroll).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const blocks = draft.blocks
  const active = blocks.find((b) => b.id === activeId)

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = blocks.findIndex((b) => b.id === active.id)
    const to = blocks.findIndex((b) => b.id === over.id)
    onReorder(arrayMove(blocks, from, to))
  }

  const move = (i, dir) => onReorder(arrayMove(blocks, i, i + dir))

  return (
    <div className="entry-view preview">
      <p className="hint preview-hint">
        Así verá el lector tu historia. <b>Arrastra</b> cualquier bloque para cambiarlo de lugar
        (en el celular, mantén el dedo pulsado un instante). Pulsa ✎ para editar un bloque aquí mismo.
      </p>

      <EntryHeader entry={draft} />

      {blocks.length === 0 ? (
        <div className="empty"><p>Todavía no hay contenido. Vuelve a “Editar” para añadir bloques.</p></div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="content">
              {blocks.map((b, i) => (
                <SortableItem
                  key={b.id}
                  block={b}
                  index={i}
                  count={blocks.length}
                  onMove={(dir) => move(i, dir)}
                  editing={editingId === b.id}
                  onEdit={() => setEditingId(editingId === b.id ? null : b.id)}
                  onDone={() => setEditingId(null)}
                  onChange={onChangeBlock}
                  onRemove={() => onRemoveBlock(b.id)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {active && <ItemView block={active} index={0} count={1} overlay />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
