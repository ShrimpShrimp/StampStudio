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
  { name: 'Place', action: 'First click sets the center.', symbol: '⌖' },
  { name: 'Press', action: 'Hold a part of the face.', symbol: '↓' },
  { name: 'Rock', action: 'Work around the edges.', symbol: '↔' },
  { name: 'Lift', action: 'Reveal it. Place another.', symbol: '↑' },
]

export default function App() {
  const [stage, setStage] = useState<'design' | 'stamp'>('design')
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [penWidth, setPenWidth] = useState(15)
  const [stampSize, setStampSize] = useState(300)
  const [designState, setDesignState] = useState({ hasInk: false, canUndo: false })
  const [paperState, setPaperState] = useState({ count: 0, canUndo: false, pressed: false, placed: false })
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const designCanvas = useRef<HTMLCanvasElement>(null)
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const originalPreview = useRef<HTMLCanvasElement>(null)
  const paperCanvas = useRef<HTMLCanvasElement>(null)
  const cursorCanvas = useRef<HTMLCanvasElement>(null)
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
    designer.current = pad
    const engine = new StampEngine(paperCanvas.current!, cursorCanvas.current!, () => {
      const current = stamper.current
      if (current) setPaperState({ count: current.count, canUndo: current.canUndo, pressed: current.isPressed, placed: current.placed })
    })
    stamper.current = engine
    return () => { pad.destroy(); engine.destroy() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
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
    window.requestAnimationFrame(() => {
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
    try {
      await stamper.current?.exportPNG()
      setNotice('Your mark, ready to keep. PNG downloaded.')
    } catch {
      setNotice('The PNG could not be saved. Please try again.')
    } finally { setExporting(false) }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); editStamp() }} aria-label="Make Your Mark — edit your stamp">
          <span className="brand-seal" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m6 23 5-15 5 12 5-12 5 15M8 27h16" /></svg></span>
          <span>Make Your Mark<span className="brand-caption">AN INTERACTIVE STAMP STUDIO</span></span>
        </a>
        <nav className="steps" aria-label="Studio stages">
          <button className={stage === 'design' ? 'step active' : 'step complete'} onClick={editStamp} aria-current={stage === 'design' ? 'step' : undefined}>
            <span className="step-number">{stage === 'stamp' ? <Icon name="check" size={13} /> : '01'}</span><span>Design your stamp</span>
          </button>
          <span className="step-connector" />
          <button className={stage === 'stamp' ? 'step active' : 'step'} disabled={!designState.hasInk} onClick={useStamp} aria-current={stage === 'stamp' ? 'step' : undefined}>
            <span className="step-number">02</span><span>Make your mark</span>
          </button>
        </nav>
      </header>

      <main>
        <section className="design-stage stage" hidden={stage !== 'design'} aria-label="Design your stamp">
          <div className="design-intro">
            <div className="eyebrow"><span className="little-line" /> IT STARTS WITH YOU</div>
            <h1>A symbol.<br />A little ink.<br /><em>Endless possibility.</em></h1>
            <p className="intro-copy">Draw something that feels like you.<br className="desktop-break" /> A signature, a shape, a happy accident.<br className="desktop-break" /> Then see where it takes you.</p>
            <div className="intro-footnote"><span className="hand-star" aria-hidden="true">✳</span><p>No perfect lines needed.<br /><span>Just something of your own.</span></p></div>
            <div className="preview-note">
              <div className="stamp-preview"><canvas ref={previewCanvas} width="128" height="128" aria-label="Live preview of your stamp" />{!designState.hasInk && <span aria-hidden="true">your<br />mark<br />here</span>}</div>
              <div><span className="eyebrow">YOUR STAMP, IN INK</span><p>A small symbol.<br />A starting point.</p></div>
            </div>
          </div>

          <div className="design-workspace">
            <div className="drawing-card">
              <div className="card-header"><span className="eyebrow">THE DRAWING BOARD</span><span className="small-label">01 / CREATE</span></div>
              <div className={`design-surface ${tool === 'eraser' ? 'erasing' : ''}`}>
                <span className="registration top-left" /><span className="registration top-right" /><span className="registration bottom-left" /><span className="registration bottom-right" />
                <canvas ref={designCanvas} aria-label="Draw your personal stamp here" aria-describedby="drawing-hint" />
                {!designState.hasInk && !designState.canUndo && <div className="drawing-placeholder" aria-hidden="true"><span className="placeholder-cross">+</span><span>Start with a line.</span></div>}
              </div>
              <div className="drawing-tools">
                <div className="tool-toggle" role="group" aria-label="Drawing tool">
                  <button className={tool === 'pen' ? 'selected' : ''} onClick={() => { setTool('pen'); designer.current!.tool = 'pen' }} aria-pressed={tool === 'pen'} title="Pen"><Icon name="pen" /><span>Draw</span></button>
                  <button className={tool === 'eraser' ? 'selected' : ''} onClick={() => { setTool('eraser'); designer.current!.tool = 'eraser' }} aria-pressed={tool === 'eraser'} title="Eraser"><Icon name="eraser" /><span>Erase</span></button>
                </div>
                <label className="stroke-control"><span className="stroke-dot" style={{ width: Math.max(4, penWidth / 1.5), height: Math.max(4, penWidth / 1.5) }} /><input type="range" min="3" max="30" value={penWidth} aria-label="Stroke width" onChange={e => { const width = Number(e.target.value); setPenWidth(width); designer.current!.width = width }} /></label>
                <div className="history-tools">
                  <button className="icon-button" onClick={() => designer.current?.undo()} disabled={!designState.canUndo} title="Undo drawing (⌘/Ctrl Z)" aria-label="Undo drawing"><Icon name="undo" /></button>
                  <button className="icon-button" onClick={() => designer.current?.clear()} disabled={!designState.hasInk} title="Clear drawing" aria-label="Clear drawing"><Icon name="clear" /></button>
                </div>
              </div>
            </div>
            <div className="design-next"><span id="drawing-hint">Make it yours. Then make a mess.</span><button className="primary-button" onClick={useStamp} disabled={!designState.hasInk}>Use this stamp <Icon name="arrow" /></button></div>
          </div>
        </section>

        <section className="stamp-stage stage" hidden={stage !== 'stamp'} aria-label="Make your mark">
          <div className="studio-title-row">
            <div><div className="eyebrow">ONE SYMBOL. SO MANY WAYS TO BE.</div><h1 ref={heading} tabIndex={-1}>Follow the <em>feeling.</em></h1></div>
            <p>Place your stamp. Work the edges.<br />Lift it to see what you’ve left behind.</p>
          </div>
          <div className="studio-toolbar">
            <div className="original-stamp"><canvas ref={originalPreview} width="128" height="128" aria-label="Your original stamp" /><div><span className="small-label">YOUR ORIGINAL</span><button className="text-button" onClick={editStamp}><Icon name="pen" size={13} /> Edit stamp</button></div></div>
            <span className="toolbar-divider" />
            <label className="size-control" title={paperState.placed ? 'Lift the stamp to change its size' : undefined}><span>Stamp size</span><input type="range" min="180" max="480" step="10" value={stampSize} disabled={paperState.placed} onChange={e => { const size = Number(e.target.value); setStampSize(size); stamper.current!.size = size; stamper.current!.preview() }} /><span className="size-value">{Math.round(stampSize / 18)}%</span></label>
            <div className="ink-swatch"><span /><span>Seal red</span></div>
            <div className="paper-actions"><button className="quiet-button" onClick={() => stamper.current?.undo()} disabled={!paperState.canUndo || paperState.pressed} title="Undo last gesture (⌘/Ctrl Z)"><Icon name="undo" /><span>Undo</span></button><button className="quiet-button" onClick={() => { stamper.current?.clear(); setNotice('A fresh sheet. Undo brings your marks back.') }} disabled={!paperState.count || paperState.pressed}><Icon name="clear" /><span>Clear</span></button><button className="primary-button export-button" onClick={exportArt} disabled={exporting || paperState.pressed}><Icon name="download" /><span>{exporting ? 'Saving…' : 'Save PNG'}</span></button></div>
          </div>
          <div className="contact-instructions" role="status" aria-live="polite">
            <div><span className="contact-step">{paperState.placed ? '02' : '01'}</span><p><strong>{paperState.placed ? 'Now press the stamp.' : 'First, place your stamp.'}</strong><span>{paperState.placed ? 'Hold its face or edges to transfer ink there. Its center stays fixed.' : 'Click the paper to set its center. Placement leaves no ink.'}</span></p></div>
            <button className="lift-button" onClick={() => stamper.current?.lift()} disabled={!paperState.placed || paperState.pressed}><Icon name="lift" size={16} /> Lift stamp <kbd>Esc</kbd></button>
          </div>
          <div className={`paper-frame ${paperState.pressed ? 'is-pressed' : ''}`}>
            <div className="paper-surface">
              <canvas ref={paperCanvas} className="paper-art" aria-label="Your stamped composition" />
              <canvas ref={cursorCanvas} className="paper-cursor" tabIndex={0} aria-label="Stamping surface: first click places the stamp; then press around its face to apply ink locally; scroll or hold arrow keys while pressed to twist; Escape lifts it" aria-describedby="gesture-help" />
              {paperState.count === 0 && !paperState.placed && <div className="paper-placeholder" aria-hidden="true"><Icon name="spark" size={28} /><span>The paper is yours.</span><small>Click to place. Then press to leave your mark.</small></div>}
            </div>
          </div>
          <div className="paper-caption"><span><span className={`status-dot ${paperState.pressed ? 'live' : ''}`} />{paperState.pressed ? 'Pressure becomes ink' : paperState.placed ? 'Stamp placed · work the edges' : paperState.count ? `${paperState.count} pressure ${paperState.count === 1 ? 'pass' : 'passes'}. Entirely yours.` : 'A fresh start'}</span><span>1800 × 1200 PX <span className="caption-separator">/</span> NOTHING TO GET RIGHT</span></div>
          <div className="keyboard-hint">Twist while pressing: scroll or hold <kbd>←</kbd> <kbd>→</kbd>. Lift with <kbd>Esc</kbd>, or click elsewhere to place again.</div>
        </section>

        <section className="gesture-strip" id="gesture-help" aria-label="Four ways to make your mark">
          <div className="gesture-intro"><span className="eyebrow">SAME STAMP.</span><span>Different expression.</span></div>
          {gestures.map((gesture, i) => <div className="gesture" key={gesture.name}><span className="gesture-symbol" aria-hidden="true">{gesture.symbol}</span><div><h2>{gesture.name}<span>0{i + 1}</span></h2><p>{gesture.action}</p></div></div>)}
        </section>
      </main>

      <footer><span>A small experiment in image & identity.</span><span>The stamp is yours. <em>The expression is too.</em></span></footer>
      <div className={`toast ${notice ? 'shown' : ''}`} role="status" aria-live="polite">{notice && <Icon name="check" size={16} />}{notice}</div>
    </div>
  )
}
