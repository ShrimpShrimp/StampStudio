import { useEffect, useRef, useState } from 'react'
import { DesignPad, StampEngine, context } from './canvas'

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

const gestures = [
  { name: 'Land', action: 'Tap for a patchy first impression.', symbol: '↓' },
  { name: 'Rock', action: 'Press around the face to fill it in.', symbol: '↔' },
  { name: 'Slide', action: 'Drag from the air. Let the ink wander.', symbol: '↝' },
  { name: 'Turn', action: 'Set your angle. Scroll over the paper.', symbol: '↻' },
]

export default function App() {
  const [stage, setStage] = useState<'design' | 'stamp'>('design')
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
        else stamper.current?.undo()
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

  function useStamp() {
    if (!designer.current?.hasInk || designer.current.isDrawing) return
    stamper.current!.setStamp(designCanvas.current!)
    stamper.current!.enabled = true
    stamper.current!.preview()
    setStage('stamp')
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }
  function editStamp() {
    stamper.current?.hide()
    if (stamper.current) stamper.current.enabled = false
    setStage('design')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  async function exportArt() {
    setExporting(true)
    try { await stamper.current?.exportPNG(); setNotice('Your stamped document is ready to keep.') }
    catch { setNotice('The PNG could not be saved. Please try again.') }
    finally { setExporting(false) }
  }
  function freshDocument() {
    stamper.current?.freshDocument()
    setNotice('A fresh request. Same personal stamp.')
  }

  const saturation = Math.min(100, Math.round(desk.wetness * 100))
  const condition = desk.spoiled ? 'soaked' : desk.wetness >= .48 ? 'damp' : 'dry'

  return <div className={`app-shell ${stage === 'stamp' ? 'desk-open' : ''}`}>
    <header className="site-header">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); editStamp() }} aria-label="Make Your Mark — edit your stamp">
        <span className="brand-seal" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m6 23 5-15 5 12 5-12 5 15M8 27h16" /></svg></span>
        <span>Make Your Mark<span className="brand-caption">A SMALL DEPARTMENT OF SELF-EXPRESSION</span></span>
      </a>
      <nav className="steps" aria-label="Studio stages">
        <button className={`step ${stage === 'design' ? 'active' : 'complete'}`} onClick={editStamp} aria-current={stage === 'design' ? 'step' : undefined}><span className="step-number">01</span><span>Make your stamp</span></button>
        <span className="step-connector" />
        <button className={`step ${stage === 'stamp' ? 'active' : ''}`} disabled={!designState.hasInk} onClick={useStamp} aria-current={stage === 'stamp' ? 'step' : undefined}><span className="step-number">02</span><span>Take the desk</span></button>
      </nav>
    </header>

    <main>
      <section className="design-stage stage" hidden={stage !== 'design'} aria-label="Design your stamp">
        <div className="design-intro">
          <div className="eyebrow"><span className="little-line" /> YOUR OWN LITTLE SEAL</div>
          <h1>Made by hand.<br />Marked <em>by you.</em></h1>
          <p className="intro-copy">A tiny symbol with a little character.<br />Shape yours into the rubber, then take it<br className="desktop-break" /> to a desk with something to stamp.</p>
          <div className="intro-footnote"><span className="hand-star" aria-hidden="true">✳</span><p>Wobbly lines welcome.<br /><span>Your lines become the inked mark.</span></p></div>
          <div className="preview-note">
            <div className="stamp-preview"><canvas ref={previewCanvas} width="128" height="128" aria-label="Live preview of your stamp" />{!designState.hasInk && <span aria-hidden="true">your<br />little<br />mark</span>}</div>
            <div><span className="eyebrow">THE IMPRESSION</span><p>A small seal.<br />Entirely your own.</p></div>
          </div>
        </div>
        <div className="design-workspace">
          <div className="bench-label"><span className="eyebrow">01 / AT THE WORKBENCH</span><span>RUBBER, READY FOR A LITTLE CHARACTER</span></div>
          <div className="rubber-holder">
            <div className={`design-surface ${tool === 'eraser' ? 'erasing' : ''}`}>
              <div className="rubber-rings" aria-hidden="true" />
              <canvas ref={designCanvas} aria-label="Shape your personal stamp on the circular rubber face" aria-describedby="drawing-hint" />
              {!designState.hasInk && !designState.canUndo && <div className="drawing-placeholder" aria-hidden="true"><span>✧</span><span>Give it some character.</span><small>SHAPE YOUR SYMBOL HERE</small></div>}
            </div>
            <span className="rubber-edge-label" aria-hidden="true">YOUR PERSONAL SEAL · MADE WITH A LITTLE PRESSURE</span>
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
          <div className="design-next"><span id="drawing-hint">One seal. A desk full of possibilities.</span><button className="primary-button" onClick={useStamp} disabled={!designState.hasInk}>Use this stamp <Icon name="arrow" /></button></div>
        </div>
      </section>

      <section className="stamp-stage stage" hidden={stage !== 'stamp'} aria-label="Review and stamp a document">
        <div className="studio-title-row">
          <div><div className="eyebrow">THE DEPARTMENT OF LITTLE THINGS</div><h1 ref={heading} tabIndex={-1}>The desk <em>is yours.</em></h1></div>
          <div className="desk-assignment"><span className="assignment-pin" aria-hidden="true">✳</span><p>One little request needs your mark.<br /><strong>A little pressure. Know when to lift.</strong></p></div>
        </div>
        <div className="desk-workspace">
          <div className="studio-toolbar">
            <div className="original-stamp"><canvas ref={originalPreview} width="128" height="128" aria-label="Your original stamp" /><div><span className="small-label">YOUR PERSONAL SEAL</span><button className="text-button" onClick={editStamp}><Icon name="pen" size={13} /> Edit stamp</button></div></div>
            <label className="size-control" title={desk.placed ? 'Lift the stamp to change its size' : undefined}><span>Size</span><input aria-label="Stamp size" type="range" min="180" max="480" step="10" value={stampSize} disabled={desk.placed || desk.pressed} onChange={e => { const size = Number(e.target.value); setStampSize(size); stamper.current!.size = size; stamper.current!.preview() }} /></label>
            <label className="angle-control"><span>Angle</span><input aria-label="Stamp angle in degrees" type="number" min="-180" max="180" step="5" value={desk.angle} disabled={desk.pressed || desk.spoiled} onChange={e => { if (e.target.value !== '') stamper.current?.setAngle(Number(e.target.value)) }} /><span>°</span></label>
            <div className="paper-actions">
              <button className="quiet-button" onClick={() => stamper.current?.undo()} disabled={!desk.canUndo || desk.pressed} title="Undo last contact (⌘/Ctrl Z)"><Icon name="undo" /><span>Undo</span></button>
              <button className="quiet-button" onClick={freshDocument} disabled={desk.pressed}><Icon name="clear" /><span>Fresh document</span></button>
              <button className="primary-button export-button" onClick={exportArt} disabled={exporting || desk.pressed}><Icon name="download" /><span>{exporting ? 'Saving…' : 'Save PNG'}</span></button>
            </div>
          </div>
          <div className={`contact-instructions ${desk.spoiled ? 'spoiled' : ''}`} role="status" aria-live="polite">
            <div><span className="contact-step">{desk.spoiled ? '!' : desk.sliding ? '↝' : desk.placed ? '02' : '01'}</span><p><strong>{desk.spoiled ? 'Oh dear. This one soaked through.' : desk.sliding ? 'Let it slide.' : desk.placed ? 'Work the edges. Then lift to reveal.' : 'A request is waiting for your seal.'}</strong><span>{desk.spoiled ? 'Too much ink in one spot. Undo the contact, or try a fresh document.' : desk.sliding ? 'The moving face leaves its own uneven trail. Release to set it down.' : desk.placed ? 'Press different parts of the face to fill in the dry patches.' : 'Tap to land a patchy mark. Or press and drag to slide the stamp.'}</span></p></div>
            <button className="lift-button" onClick={() => stamper.current?.lift()} disabled={!desk.placed || desk.pressed || desk.spoiled}><Icon name="lift" size={16} /> Lift stamp <kbd>Esc</kbd></button>
          </div>
          <div className="document-desk">
            <div className="desk-tab"><span className="status-dot" /> INCOMING / {String(desk.sheet).padStart(3, '0')}</div>
            <div className={`paper-frame ${desk.pressed ? 'is-pressed' : ''} ${desk.spoiled ? 'paper-spoiled' : ''}`}>
              <div className="paper-surface">
                <canvas ref={documentCanvas} className="document-art" aria-label="Illustrated request form with a stamp-here area" />
                <canvas ref={damageCanvas} className="paper-damage" aria-label="Paper moisture and ink seepage" />
                <canvas ref={paperCanvas} className="paper-art" aria-label="Your stamped composition" />
                <canvas ref={cursorCanvas} className="paper-cursor" tabIndex={0} aria-label="Stamping surface: tap to place and ink; drag from a lifted stamp to slide; press a placed stamp to rock; scroll or use arrow keys to rotate before or during contact; Escape lifts" aria-describedby="gesture-help" />
              </div>
            </div>
            <div className="paper-caption"><span>{desk.spoiled ? 'FILE STATUS: SPOILED' : desk.count ? `${desk.count} CONTACT${desk.count === 1 ? '' : 'S'} · MARKED BY YOU` : 'FILE STATUS: AWAITING YOUR MARK'}</span><span>1800 × 1200 PX / READY TO KEEP</span></div>
          </div>
          <div className={`paper-condition ${condition}`}>
            <div><span className="wet-label">{desk.spoiled ? 'Paper soaked through' : condition === 'damp' ? 'Getting damp — give it a lift' : 'Easy does it. Paper absorbs ink.'}</span><span className="wet-meter" role="progressbar" aria-label="Paper saturation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={saturation}><span style={{ width: `${saturation}%` }} /></span></div>
            <span>{desk.spoiled ? 'A fresh sheet is one click away.' : 'Scroll over the paper to turn · ← → · Esc to lift'}</span>
          </div>
        </div>
      </section>

      <section className="gesture-strip" id="gesture-help" aria-label="Ways to use your stamp">
        <div className="gesture-intro"><span className="eyebrow">ONE LITTLE SEAL.</span><span>A personal touch.</span></div>
        {gestures.map((gesture, i) => <div className="gesture" key={gesture.name}><span className="gesture-symbol" aria-hidden="true">{gesture.symbol}</span><div><h2>{gesture.name}<span>0{i + 1}</span></h2><p>{gesture.action}</p></div></div>)}
      </section>
    </main>
    <footer><span>A small experiment in image & identity.</span><span>Filed under: <em>perfectly imperfect.</em></span></footer>
    <div className={`toast ${notice ? 'shown' : ''}`} role="status" aria-live="polite">{notice && <Icon name="check" size={16} />}{notice}</div>
  </div>
}
