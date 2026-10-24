import { useObjectURL } from '../useObjectURL.js'
import { sanitize } from '../richText.js'
import { fadeStyle, styleInfo } from '../imageStyles.js'

function ImageBlock({ block }) {
  const url = useObjectURL(block.image)
  if (!url) return <div className="image-missing">Imagen sin elegir</div>
  return (
    <figure className={`figure-${block.size || 'normal'} style-${styleInfo(block).value}`}>
      <img src={url} alt={block.caption || ''} loading="lazy" style={fadeStyle(block)} />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

// Un bloque tal como lo ve el lector. Lo usan la vista de lectura y la vista previa del editor.
export default function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h2>{block.text}</h2>
    case 'quote':
      return (
        <blockquote className="pull-quote">
          <p>{block.text || '…'}</p>
          {block.caption && <cite>— {block.caption}</cite>}
        </blockquote>
      )
    case 'image':
      return <ImageBlock block={block} />
    default:
      return block.html
        ? <div className={`prose ${block.dropCap ? 'dropcap' : ''}`} dangerouslySetInnerHTML={{ __html: sanitize(block.html) }} />
        : <div className={`prose ${block.dropCap ? 'dropcap' : ''}`}><p className="text">{block.text}</p></div>
  }
}
