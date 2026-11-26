import { useEffect, useRef, useState } from 'react'
import { DesignPad, StampEngine, context } from './canvas'
import GlobalBoard from './board/GlobalBoard'
import StampHelp from './StampHelp'

type IconName = 'pen' | 'eraser' | 'undo' | 'clear' | 'arrow' | 'back' | 'download' | 'spark' | 'check' | 'lift'
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    pen: <><path d="m4 16-1 5 5-1L20 8a2.1 2.1 0 0 0-4-4L4 16Z" /><path d="m14 6 4 4M4 16l4 4" /></>,
    eraser: <><path d="m13 3 8 8-10 10H7l-5-5L13 3Z" /><path d="m7 11 8 8M11 21h10" /></>,
    undo: <><path d="M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -3)" /><path d="m8 3-4 4 4 4" /></>,
    clear: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    back: <><path d="M20 12H4m6-6-6 6 6 6" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lift: <><path d="M12 16V3m-5 5 5-5 5 5M4 18v3h16v-3" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function App() {
  const [stage, setStage] = useState<'design' | 'stamp' | 'board'>('design')
  const [destination, setDestination] = useState<'personal' | 'board'>('personal')
  const [stampVersion, setStampVersion] = useState(0)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [penWidth, setPenWidth] = useState(16)
  const [stampSize, setStampSize] = useState(320)
  const [designState, setDesignState] = useState({ hasInk: false, canUndo: false })
  const [desk, setDesk] = useState({ count: 0, canUndo: false, pressed: false, placed: false, sliding: false, angle: 0, wetness: 0, spoiled: false, sheet: 1 })
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const designCanvas = useRef<HTMLCanvasElement>(null)
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const originalPreview = useRef<HTMLCanvasElement>(null)
  const paperCanvas = useRef<HTMLCanvasElement>(null)
  const cursorCanvas = useRef<HTMLCanvasElement>(null)
  const documentCanvas = useRef<HTMLCanvasElement>(null)
  const damageCanvas = useRef<HTMLCanvasElement>(null)
  const designer = useRef<DesignPad | null>(null)
  const stamper = useRef<StampEngine | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const pad = new DesignPad(designCanvas.current!, () => {
      const current = designer.current
      if (!current) return
      setDesignState({ hasInk: current.hasInk, canUndo: current.canUndo })
      for (const preview of [previewCanvas.current, originalPreview.current]) {
        if (!preview) continue
        const ctx = context(preview)
        ctx.clearRect(0, 0, preview.width, preview.height)
        ctx.drawImage(current.canvas, 0, 0, preview.width, preview.height)
      }
    })
    pad.width = 16
    designer.current = pad
    const engine = new StampEngine(paperCanvas.current!, cursorCanvas.current!, documentCanvas.current!, damageCanvas.current!, () => {
      const current = stamper.current
      if (current) setDesk({ count: current.count, canUndo: current.canUndo, pressed: current.isPressed, placed: current.placed, sliding: current.isSliding, angle: Math.round(current.angle), wetness: current.wetness, spoiled: current.spoiled, sheet: current.sheet })
    })
    stamper.current = engine
    return () => { pad.destroy(); engine.destroy() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        if (stage === 'design') designer.current?.undo()
        else if (stage === 'stamp') stamper.current?.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  function useStamp(target = destination) {
    if (!designer.current?.hasInk || designer.current.isDrawing) return
    if (target === 'board') { openBoard(); return }
    stamper.current!.setStamp(designCanvas.current!)
    stamper.current!.enabled = true
    stamper.current!.preview()
    setStage('stamp')
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }
  function openBoard() {
    stamper.current?.hide()
    if (stamper.current) stamper.current.enabled = false
    setDestination('board'); setStampVersion(v => v + 1); setStage('board')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function editStamp() {
    stamper.current?.hide()
    if (stamper.current) stamper.current.enabled = false
    setStage('design')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  async function exportArt() {
    setExporting(true)
    try { await stamper.current?.exportPNG(); setNotice('Document saved.') }
    catch { setNotice('The PNG could not be saved. Please try again.') }
    finally { setExporting(false) }
  }
  function freshDocument() {
    stamper.current?.freshDocument()
    setNotice('Fresh document ready.')
  }

  const saturation = Math.min(100, Math.round(desk.wetness * 100))
  const condition = desk.spoiled ? 'soaked' : desk.wetness >= .48 ? 'damp' : 'dry'

  return <div className={`app-shell ${stage === 'stamp' ? 'desk-open' : stage === 'board' ? 'board-open' : ''}`}>
    <header className="site-header">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); editStamp() }} aria-label="Make Your Mark — edit your stamp">
        <span className="brand-seal" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m6 23 5-15 5 12 5-12 5 15M8 27h16" /></svg></span>
        <span>Make Your Mark</span>
      </a>
      <nav className="studio-nav" aria-label="Studio navigation">
        <button onClick={editStamp} aria-current={stage === 'design' ? 'page' : undefined}>Make stamp</button>
        <button onClick={() => { setDestination('personal'); if (designState.hasInk) useStamp('personal'); else { editStamp(); setNotice('Make a stamp to open your studio.') } }} aria-current={stage === 'stamp' ? 'page' : undefined}>Personal studio</button>
        <button onClick={openBoard} aria-current={stage === 'board' ? 'page' : undefined}>Shared board</button>
      </nav>
    </header>

    <main>
      <section className="design-stage stage" hidden={stage !== 'design'} aria-label="Design your stamp">
        <div className="design-intro">
          <h1>Made by hand.<br />{' '}Marked <em>by you.</em></h1>
          <p className="intro-copy" id="drawing-hint">Carve a symbol. Your lines become the stamp.</p>
          <p className="intro-footnote">Wobbly lines welcome.</p>
          <div className="preview-note" hidden={!designState.hasInk}>
            <div className="stamp-preview"><canvas ref={previewCanvas} width="128" height="128" aria-label="Live preview of your stamp" /></div>
            <span>Your stamp</span>
          </div>
        </div>
        <div className="design-workspace">
          <div className="rubber-holder">
            <div className={`design-surface ${tool === 'eraser' ? 'erasing' : ''}`}>
              <div className="rubber-rings" aria-hidden="true" />
              <canvas ref={designCanvas} aria-label="Shape your personal stamp on the circular rubber face" aria-describedby="drawing-hint" />
              {!designState.hasInk && !designState.canUndo && <div className="drawing-placeholder" aria-hidden="true"><span>✧</span><span>Carve here.</span></div>}
            </div>
          </div>
          <div className="carving-tools">
            <div className="tool-toggle" role="group" aria-label="Shaping tool">
              <button className={tool === 'pen' ? 'selected' : ''} onClick={() => { setTool('pen'); designer.current!.tool = 'pen' }} aria-pressed={tool === 'pen'}><Icon name="pen" size={16} /> Carve</button>
              <button className={tool === 'eraser' ? 'selected' : ''} onClick={() => { setTool('eraser'); designer.current!.tool = 'eraser' }} aria-pressed={tool === 'eraser'}><Icon name="eraser" size={16} /> Restore</button>
            </div>
            <div className="cut-widths" role="group" aria-label="Carving width">{[{ width: 8, name: 'Fine' }, { width: 16, name: 'Line' }, { width: 28, name: 'Bold' }].map(choice => <button key={choice.width} title={choice.name} aria-label={`${choice.name} carving tool`} aria-pressed={penWidth === choice.width} className={penWidth === choice.width ? 'selected' : ''} onClick={() => { setPenWidth(choice.width); designer.current!.width = choice.width }}><span style={{ height: choice.width / 3 }} /></button>)}</div>
            <div className="history-tools">
              <button className="icon-button" onClick={() => designer.current?.undo()} disabled={!designState.canUndo} title="Undo shaping (⌘/Ctrl Z)" aria-label="Undo shaping"><Icon name="undo" /></button>
              <button className="icon-button" onClick={() => designer.current?.clear()} disabled={!designState.hasInk} title="Start the stamp over" aria-label="Clear stamp design"><Icon name="clear" /></button>
            </div>
          </div>
          <div className="design-next">
            <div className="destination-choice" role="group" aria-label="Where to take your stamp"><button aria-pressed={destination === 'personal'} onClick={() => setDestination('personal')}>Personal studio</button><button aria-pressed={destination === 'board'} onClick={() => setDestination('board')}>Shared board</button></div>
            <button className="primary-button" onClick={() => useStamp()} disabled={!designState.hasInk}>{destination === 'board' ? 'Stamp on shared board' : 'Stamp privately'}</button>
          </div>
        </div>
      </section>

      <section className="stamp-stage stage" hidden={stage !== 'stamp'} aria-label="Review and stamp a document">
        <div className="studio-title-row">
          <h1 ref={heading} tabIndex={-1}>Personal <em>studio.</em></h1>
        </div>
        <div className="desk-workspace">
          <div className="studio-toolbar">
            <div className="original-stamp"><canvas ref={originalPreview} width="128" height="128" aria-label="Your original stamp" /><button className="text-button" onClick={editStamp}><Icon name="pen" size={16} /> Edit stamp</button></div>
            <label className="size-control" title={desk.placed ? 'Lift the stamp to change its size' : undefined}><span>Size</span><input aria-label="Stamp size" type="range" min="180" max="480" step="10" value={stampSize} disabled={desk.placed || desk.pressed} onChange={e => { const size = Number(e.target.value); setStampSize(size); stamper.current!.size = size; stamper.current!.preview() }} /></label>
            <label className="angle-control"><span>Angle</span><input aria-label="Stamp angle in degrees" type="number" min="-180" max="180" step="5" value={desk.angle} disabled={desk.pressed || desk.spoiled} onChange={e => { if (e.target.value !== '') stamper.current?.setAngle(Number(e.target.value)) }} /><span>°</span></label>
            <div className="paper-actions">
              <button className="quiet-button" onClick={() => stamper.current?.undo()} disabled={!desk.canUndo || desk.pressed} title="Undo last contact (⌘/Ctrl Z)"><Icon name="undo" /><span>Undo</span></button>
              <button className="quiet-button" onClick={freshDocument} disabled={desk.pressed}><Icon name="clear" /><span>New document</span></button>
              <button className="primary-button export-button" onClick={exportArt} disabled={exporting || desk.pressed}><Icon name="download" /><span>{exporting ? 'Saving…' : 'Save PNG'}</span></button>
            </div>
          </div>
          <div className={`contact-instructions ${desk.spoiled ? 'spoiled' : ''}`} role="status" aria-live="polite">
            <p id="personal-hint">{desk.spoiled ? 'Paper soaked through. Undo or start a new document.' : desk.sliding ? 'Slower leaves more ink. Release to stop sliding.' : desk.placed ? 'Press around the edges, then lift.' : 'Tap to place. Drag to smear.'}</p>
            <button className="lift-button" onClick={() => stamper.current?.lift()} disabled={!desk.placed || desk.pressed || desk.spoiled}><Icon name="lift" size={16} /> Lift stamp <kbd>Esc</kbd></button>
          </div>
          <StampHelp />
          <div className="document-desk">
            <div className={`paper-frame ${desk.pressed ? 'is-pressed' : ''} ${desk.spoiled ? 'paper-spoiled' : ''}`}>
              <div className="paper-surface">
                <canvas ref={documentCanvas} className="document-art" aria-label="Illustrated request form with a stamp-here area" />
                <canvas ref={damageCanvas} className="paper-damage" aria-label="Paper moisture and ink seepage" />
                <canvas ref={paperCanvas} className="paper-art" aria-label="Your stamped composition" />
                <canvas ref={cursorCanvas} className="paper-cursor" tabIndex={0} aria-label="Stamping surface: tap to place and ink; drag from a lifted stamp to slide; press a placed stamp to rock; scroll or use arrow keys to rotate before or during contact; Escape lifts" aria-describedby="personal-hint" />
              </div>
            </div>
            <div className="paper-caption"><span>Document {desk.sheet}</span><span>Private · Save to keep</span></div>
          </div>
          <div className={`paper-condition ${condition}`}>
            <div><span className="wet-label">{desk.spoiled ? 'Soaked' : condition === 'damp' ? 'Getting damp — lift soon' : 'Paper moisture'}</span><span className="wet-meter" role="progressbar" aria-label="Paper saturation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={saturation}><span style={{ width: `${saturation}%` }} /></span></div>
          </div>
        </div>
      </section>

      <GlobalBoard active={stage === 'board'} stamp={designState.hasInk ? designCanvas.current : null} version={stampVersion} onEdit={() => { setDestination('board'); editStamp() }} />
    </main>
    <div className={`toast ${notice ? 'shown' : ''}`} role="status" aria-live="polite">{notice && <Icon name="check" size={16} />}{notice}</div>
  </div>
}
