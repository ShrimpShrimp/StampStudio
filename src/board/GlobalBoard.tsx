import { useEffect, useRef, useState } from 'react'
import { StampEngine, context } from '../canvas'
import { boardConnection, BoardRequestError, contributionImage, encodePNG, listContributions, submitContribution } from './client'
import { readDraft, saveDraft } from './drafts'
import { BOARD_HEIGHT, BOARD_WIDTH, INKS, type Draft } from './types'
import './board.css'
import StampHelp from '../StampHelp'

type Props = { active: boolean; stamp: HTMLCanvasElement | null; version: number; onEdit: () => void }
export default function GlobalBoard({ active, stamp, version, onEdit }: Props) {
  const paper = useRef<HTMLCanvasElement>(null), cursor = useRef<HTMLCanvasElement>(null)
  const background = useRef<HTMLCanvasElement>(null), damage = useRef<HTMLCanvasElement>(null)
  const viewport = useRef<HTMLDivElement>(null), engine = useRef<StampEngine | null>(null)
  const moveButton = useRef<HTMLButtonElement>(null), fitScale = useRef(.4)
  const dragging = useRef<{ pointerId: number; x: number; y: number; offset: { x: number; y: number } } | null>(null)
  const composite = useRef<HTMLCanvasElement | null>(null)
  const draft = useRef<Draft | null>(null), cursorSequence = useRef(0), seen = useRef(new Set<string>())
  const syncJob = useRef<Promise<void> | null>(null), saveJob = useRef(Promise.resolve())
  const revision = useRef(0), lastCount = useRef(0), suppress = useRef(false), alive = useRef(true)
  const [ready, setReady] = useState(false), [hasDraft, setHasDraft] = useState(false)
  const [pending, setPending] = useState(false), [busy, setBusy] = useState(false)
  const [total, setTotal] = useState(0), [loaded, setLoaded] = useState(false), [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState(''), [storageWarning, setStorageWarning] = useState('')
  const [ink, setInk] = useState<string>(INKS[0].value), [size, setSize] = useState(320)
  const [pan, setPan] = useState(false), [zoom, setZoom] = useState(1), [fit, setFit] = useState(.4)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [state, setState] = useState({ count: 0, canUndo: false, pressed: false, placed: false, sliding: false, angle: 0 })

  const moving = pan || !stamp

  function paintBackground() {
    if (!background.current || !composite.current) return
    const ctx = context(background.current)
    ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT)
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0,0,BOARD_WIDTH,BOARD_HEIGHT)
    ctx.drawImage(composite.current,0,0)
  }
  function queueSave(value: Draft | null) {
    saveJob.current = saveJob.current.catch(() => {}).then(() => saveDraft(value)).then(() => {
      if (alive.current) setStorageWarning('')
    }).catch(() => { if (alive.current) setStorageWarning('This browser could not save your draft for a refresh. Keep this tab open or download it.') })
    return saveJob.current
  }
  function persistContact() {
    if (suppress.current || !engine.current || engine.current.isPressed) return
    const generation = ++revision.current
    const captured = engine.current.captureDraft()
    saveJob.current = saveJob.current.catch(() => {}).then(async () => {
      const value = await captured
      if (generation !== revision.current || !alive.current) return
      draft.current = value ? { ...value, id: crypto.randomUUID() } : null
      setHasDraft(!!value); setPending(false); setMessage('')
      try { await saveDraft(draft.current); setStorageWarning('') }
      catch { setStorageWarning('This browser could not save your draft for a refresh. Keep this tab open or download it.') }
    }).catch(() => {
      if (generation !== revision.current || !alive.current) return
      setHasDraft(false)
      setStorageWarning('The latest contact could not be prepared for sharing. Keep this tab open and try Undo or another contact.')
    })
  }
  function clearLocal() {
    revision.current++; suppress.current = true; lastCount.current = 0
    engine.current?.resetDraft(); suppress.current = false
    draft.current = null; setHasDraft(false); setPending(false)
    void queueSave(null)
  }
  async function synchronize() {
    if (boardConnection === 'unconfigured') return
    if (syncJob.current) return syncJob.current
    const job = (async () => {
      setRefreshing(true)
      try {
        let more = true
        while (more && alive.current) {
          const page = await listContributions(cursorSequence.current)
          for (const row of page.contributions) {
            if (!alive.current) return
            if (!seen.current.has(row.id)) {
              const bitmap = await createImageBitmap(await contributionImage(row.id))
              if (!alive.current) { bitmap.close(); return }
              context(composite.current!).drawImage(bitmap,row.x,row.y); bitmap.close()
              seen.current.add(row.id)
            }
            cursorSequence.current = row.sequence
          }
          more = page.hasMore; setTotal(page.total)
        }
        paintBackground(); setLoaded(true)
        if (draft.current?.pending && seen.current.has(draft.current.id)) {
          clearLocal(); setMessage('Shared. Your mark stays here.')
        }
      } finally { if (alive.current) setRefreshing(false) }
    })()
    syncJob.current = job
    try { await job } finally { syncJob.current = null }
  }
  const actions = useRef({ synchronize, persistContact }); actions.current = { synchronize, persistContact }

  useEffect(() => {
    alive.current = true
    composite.current = document.createElement('canvas')
    composite.current.width = BOARD_WIDTH; composite.current.height = BOARD_HEIGHT
    const current = new StampEngine(paper.current!, cursor.current!, background.current!, damage.current!, () => {
      const e = engine.current; if (!e || !alive.current) return
      setState({ count: e.count, canUndo: e.canUndo, pressed: e.isPressed, placed: e.placed, sliding: e.isSliding, angle: Math.round(e.angle) })
      if (!suppress.current && !e.isPressed && e.count !== lastCount.current) {
        lastCount.current = e.count; actions.current.persistContact()
      }
    }, { shared: true, width: BOARD_WIDTH, height: BOARD_HEIGHT, ink: INKS[0].value, background: paintBackground })
    current.size = 320; engine.current = current
    void (async () => {
      try {
        const saved = await readDraft()
        if (!alive.current) return
        if (saved) {
          draft.current = saved; suppress.current = true
          current.options.ink = saved.color; setInk(saved.color)
          await current.restoreDraft(saved)
          lastCount.current = current.count; suppress.current = false
          setHasDraft(true); setPending(!!saved.pending)
          setMessage(saved.pending ? 'Checking your previous share. Retry won’t add a duplicate.' : 'Draft restored. Not shared yet.')
        }
      } catch { setStorageWarning('Draft recovery is unavailable in this browser. Keep this tab open or download your work.') }
      finally { if (alive.current) setReady(true) }
    })()
    return () => { alive.current = false; current.destroy(); engine.current = null }
  }, [])
  useEffect(() => {
    const e = engine.current
    if (!e) return
    e.enabled = active && ready && !!stamp && !moving && !busy && !pending
    if (!e.enabled) e.hide()
    if (stamp && ready) { e.setStamp(stamp); e.preview() }
  }, [active, ready, stamp, version, moving, busy, pending, ink])
  useEffect(() => {
    if (!active || !ready) return
    const refresh = () => void actions.current.synchronize().catch(() => setMessage('Couldn’t refresh the board. Your draft is kept.'))
    refresh()
    const timer = window.setInterval(refresh,15000)
    return () => clearInterval(timer)
  }, [active, ready])
  useEffect(() => {
    if (!active || !viewport.current) return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.max(.08, Math.min((entry.contentRect.width - 40) / BOARD_WIDTH, (entry.contentRect.height - 40) / BOARD_HEIGHT))
      const ratio = next / fitScale.current
      fitScale.current = next; setFit(next)
      setOffset(current => ({ x: current.x * ratio, y: current.y * ratio }))
    })
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [active])
  useEffect(() => {
    const view = viewport.current
    if (!active || !moving || !view) return
    view.focus({ preventScroll: true })
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (dragging.current) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1
      setOffset(current => ({ x: current.x - event.deltaX * unit, y: current.y - event.deltaY * unit }))
    }
    const cancelMove = () => {
      const contact = dragging.current; dragging.current = null
      if (contact && view.hasPointerCapture(contact.pointerId)) view.releasePointerCapture(contact.pointerId)
    }
    const visibility = () => { if (document.hidden) cancelMove() }
    view.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', cancelMove)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      view.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', cancelMove)
      document.removeEventListener('visibilitychange', visibility)
      cancelMove()
    }
  }, [active, moving])
  useEffect(() => {
    if (!active) return
    const undo = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault(); if (!pending && !busy) engine.current?.undo()
      }
    }
    window.addEventListener('keydown',undo); return () => window.removeEventListener('keydown',undo)
  }, [active,pending,busy])

  async function commit() {
    if (busy || !hasDraft || !loaded || boardConnection === 'unconfigured') return
    setBusy(true); engine.current!.enabled = false; engine.current!.lift()
    try {
      await saveJob.current
      const value = draft.current; if (!value) return
      value.pending = true; setPending(true); await queueSave(value)
      await submitContribution({ id: value.id, x: value.x, y: value.y, width: value.width, height: value.height, color: value.color, image: await encodePNG(value.blob) })
      await actions.current.synchronize()
      if (draft.current) setMessage('Share accepted. Refresh to confirm it appears. Your draft is kept until then.')
    } catch (error) {
      const confirmed = error instanceof BoardRequestError && error.status >= 400 && error.status < 500
      if (confirmed && draft.current) { draft.current.pending = false; setPending(false); await queueSave(draft.current) }
      setMessage(error instanceof BoardRequestError ? error.message : 'Couldn’t confirm sharing. Your draft is kept.')
    } finally { setBusy(false) }
  }
  async function downloadDraft() {
    await saveJob.current
    const value = draft.current; if (!value) return
    const url = URL.createObjectURL(value.blob), link = document.createElement('a')
    link.href = url; link.download = 'my-unshared-stamp.png'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url),1000)
  }
  function changeZoom(next: number) {
    const ratio = next / zoom
    setZoom(next)
    // Keep the point under the middle of the view in place while zooming.
    setOffset(current => ({ x: current.x * ratio, y: current.y * ratio }))
  }
  function endMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current?.pointerId !== event.pointerId) return
    dragging.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const disabled = !ready || busy || pending || state.pressed
  const scale = fit * zoom

  const hint = moving ? 'Drag to move.' : pending || busy ? 'Sharing is being checked. Your draft is kept.' : state.sliding ? 'Slower leaves more ink. Release to stop sliding.' : state.placed ? 'Press around the edges, then lift.' : 'Tap to place. Drag to smear.'

  return <section className="global-stage" hidden={!active} aria-label="Shared board">
    <div className="board-heading"><h1>Shared <em>board.</em></h1><p>Add your stamp to a growing artwork.</p></div>
    <div className="board-workspace">
      <aside className="board-tools" aria-label="Shared board tools">
        <div className="board-stamp-entry">{stamp ? <><h2>Your stamp</h2><button className="text-button" onClick={onEdit} disabled={state.pressed || busy}>Edit stamp</button></> : <><button className="primary-button" onClick={onEdit} disabled={busy}>Make a stamp</button><p>Browse now, or bring your own stamp.</p></>}</div>
        {stamp && <div className="board-stamp-controls">
          <fieldset disabled={disabled || hasDraft || state.count > 0}><legend>Ink</legend><div className="board-inks">{INKS.map(color => <button key={color.value} className={ink === color.value ? 'selected' : ''} aria-label={color.name} aria-pressed={ink === color.value} style={{ '--ink': color.value } as React.CSSProperties} onClick={() => { setInk(color.value); engine.current!.options.ink = color.value }} />)}</div>{hasDraft && <small>Share or discard to change ink.</small>}</fieldset>
          <label className="board-control">Size<input aria-label="Shared stamp size" type="range" min="120" max="520" step="10" value={size} disabled={disabled || state.placed} onChange={e => { setSize(+e.target.value); engine.current!.size = +e.target.value; engine.current!.preview() }} /></label>
          <label className="board-control">Angle <span><input aria-label="Shared stamp angle" type="number" value={state.angle} min="-180" max="180" step="5" disabled={disabled} onChange={e => e.target.value !== '' && engine.current?.setAngle(+e.target.value)} /> °</span></label>
          <button className="quiet-button" onClick={() => engine.current?.lift()} disabled={disabled || !state.placed}>Lift stamp <kbd>Esc</kbd></button>
        </div>}
        {hasDraft && <div className="board-draft-tools"><h2>Your draft</h2>
          <p className="board-draft-status" role="status" aria-live="polite">{pending ? 'Sharing isn’t confirmed. Retry won’t add a duplicate. Editing is paused.' : message || 'Not shared yet.'}</p>
          <button className="primary-button board-share" onClick={() => void commit()} disabled={busy || state.pressed || !loaded || boardConnection === 'unconfigured'}>{busy ? 'Sharing…' : pending ? 'Retry sharing' : 'Share to board'}</button>
          <div className="board-action-pair"><button className="quiet-button" onClick={() => engine.current?.undo()} disabled={disabled || !state.canUndo}>Undo</button><button className="quiet-button" disabled={disabled} onClick={() => { clearLocal(); setMessage('Draft discarded.') }}>Discard</button></div>
          <button className="text-button" disabled={busy || state.pressed} onClick={() => void downloadDraft()}>Save draft</button>
        </div>}
        {stamp && <StampHelp />}
      </aside>
      <div className="board-main">
        <div className="board-topline"><span>{boardConnection === 'local' ? 'Local shared preview' : boardConnection === 'unconfigured' ? 'Sharing unavailable' : loaded ? `${total} contribution${total === 1 ? '' : 's'}` : 'Opening board…'}</span><div className="board-view-tools">
          <div className="board-modes" role="group" aria-label="Board interaction"><button aria-pressed={!moving} disabled={!stamp || state.pressed || busy || pending} onClick={() => setPan(false)}>Stamp</button><button ref={moveButton} aria-pressed={moving} onClick={() => { engine.current?.lift(); setPan(true) }} disabled={state.pressed}>Move</button></div>
          <div className="board-zoom" role="group" aria-label="Board zoom"><button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => changeZoom(Math.max(1,zoom-.5))}>−</button><button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}>Fit</button><button aria-label="Zoom in" disabled={zoom >= 4} onClick={() => changeZoom(Math.min(4,zoom+.5))}>+</button></div>
          <button aria-label="Refresh board" onClick={() => void synchronize().catch(() => setMessage('Couldn’t refresh the board. Your draft is kept.'))} disabled={refreshing || boardConnection === 'unconfigured'}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div></div>
        <div className={`board-viewport ${moving ? 'panning' : ''}`} ref={viewport} role="region" aria-label="Shared board view" tabIndex={active && moving ? 0 : -1}
          onPointerDownCapture={e => {
            if (!active || !moving || e.button !== 0 || dragging.current) return
            e.preventDefault(); e.stopPropagation(); e.currentTarget.focus({ preventScroll: true })
            dragging.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, offset }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={e => {
            const start = dragging.current
            if (!moving || !start || start.pointerId !== e.pointerId) return
            setOffset({ x: start.offset.x + e.clientX - start.x, y: start.offset.y + e.clientY - start.y })
          }}
          onPointerUp={endMove} onPointerCancel={endMove} onLostPointerCapture={e => { if (dragging.current?.pointerId === e.pointerId) dragging.current = null }}
          onKeyDown={e => {
            if (!moving) return
            const step = { ArrowLeft: [40,0], ArrowRight: [-40,0], ArrowUp: [0,40], ArrowDown: [0,-40] }[e.key]
            if (step) { e.preventDefault(); e.stopPropagation(); setOffset(current => ({ x: current.x + step[0], y: current.y + step[1] })) }
            else if (e.key === 'Escape' && stamp) { e.preventDefault(); e.stopPropagation(); setPan(false); moveButton.current?.focus() }
          }}>
          <div className="board-scene">
            <div className="shared-sheet" style={{ width: BOARD_WIDTH * scale, height: BOARD_HEIGHT * scale, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }}>
              <canvas ref={background} aria-label="Persistent collective artwork" data-testid="shared-artwork" />
              <canvas ref={damage} aria-hidden="true" />
              <canvas ref={paper} aria-label="Your unshared ink" data-testid="shared-draft" />
              <canvas ref={cursor} className="shared-cursor" tabIndex={active ? 0 : -1} aria-label="Shared stamping surface" aria-describedby="board-hint" />
              {boardConnection === 'unconfigured' && <div className="board-unconfigured">The shared board isn’t connected yet.<br /><span>You can try a local draft here. Sharing will open when storage is ready.</span></div>}
            </div>
          </div>
        </div>
        <div className="board-bottomline"><p id="board-hint" role="status">{hint}</p><span>Shared marks stay</span></div>
        {!hasDraft && message && <p className="board-message" role="status" aria-live="polite">{message}</p>}
        {storageWarning && <p className="board-warning" role="alert">{storageWarning}</p>}
      </div>
    </div>
  </section>
}
