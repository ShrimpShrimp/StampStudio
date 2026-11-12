export const INK = '#a52d2b'
export const PAPER = '#fffdf7'
export const DESIGN_SIZE = 512
export const PAPER_WIDTH = 1800
export const PAPER_HEIGHT = 1200

export function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This experience needs a browser with Canvas 2D support.')
  return ctx
}

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export type Point = { x: number; y: number }
export type Pose = Point & { angle: number }

export function pointOn(canvas: HTMLCanvasElement, e: PointerEvent): Point {
  const box = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - box.left) / box.width) * canvas.width,
    y: ((e.clientY - box.top) / box.height) * canvas.height,
  }
}

// Ink is proportional to distance/rotation, independent of pointer-event frequency.
export function sweep(from: Pose, to: Pose, size: number) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const turn = Math.abs(to.angle - from.angle)
  const steps = Math.max(1, Math.ceil(distance / (size * 0.045)), Math.ceil(turn / 0.035))
  const alpha = -Math.expm1(-(distance / size * 2.8 + turn * 0.38) / steps)
  return { steps, alpha }
}

/** Transparent original artwork; one history entry per pen/eraser stroke. */
export class DesignPad {
  private ctx: CanvasRenderingContext2D
  private history: ImageData[] = []
  private pointer: number | null = null
  private previous: Point | null = null
  tool: 'pen' | 'eraser' = 'pen'
  width = 15
  hasInk = false
  private abort = new AbortController()

  constructor(readonly canvas: HTMLCanvasElement, private changed: () => void) {
    canvas.width = canvas.height = DESIGN_SIZE
    this.ctx = context(canvas)
    const options = { signal: this.abort.signal }
    canvas.addEventListener('pointerdown', this.down, options)
    canvas.addEventListener('pointermove', this.move, options)
    canvas.addEventListener('pointerup', this.up, options)
    canvas.addEventListener('pointercancel', this.up, options)
    canvas.addEventListener('lostpointercapture', this.up, options)
    window.addEventListener('blur', this.finish, options)
  }

  get canUndo() { return this.history.length > 0 }
  get isDrawing() { return this.pointer !== null }
  private snapshot() {
    this.history.push(this.ctx.getImageData(0, 0, DESIGN_SIZE, DESIGN_SIZE))
    if (this.history.length > 30) this.history.shift()
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0 || this.pointer !== null) return
    e.preventDefault()
    this.snapshot()
    this.pointer = e.pointerId
    this.canvas.setPointerCapture(e.pointerId)
    this.previous = pointOn(this.canvas, e)
    this.stroke(this.previous, this.previous)
  }
  private stroke(from: Point, to: Point) {
    this.ctx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over'
    this.ctx.strokeStyle = this.ctx.fillStyle = INK
    this.ctx.lineWidth = this.width * (this.tool === 'eraser' ? 2 : 1)
    this.ctx.lineJoin = this.ctx.lineCap = 'round'
    if (from.x === to.x && from.y === to.y) {
      this.ctx.beginPath()
      this.ctx.arc(to.x, to.y, this.ctx.lineWidth / 2, 0, Math.PI * 2)
      this.ctx.fill()
    } else {
      this.ctx.beginPath()
      this.ctx.moveTo(from.x, from.y)
      this.ctx.lineTo(to.x, to.y)
      this.ctx.stroke()
    }
    this.changed()
  }
  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer || !this.previous) return
    const samples = e.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [e]) {
      const next = pointOn(this.canvas, sample)
      this.stroke(this.previous, next)
      this.previous = next
    }
  }
  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return
    this.finish()
  }
  finish = () => {
    const id = this.pointer
    this.pointer = null
    this.previous = null
    if (id !== null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
    this.refresh()
  }
  refresh() {
    const pixels = this.ctx.getImageData(0, 0, DESIGN_SIZE, DESIGN_SIZE).data
    this.hasInk = pixels.some((value, index) => index % 4 === 3 && value > 0)
    this.changed()
  }
  undo() {
    if (this.isDrawing) return
    const image = this.history.pop()
    if (image) this.ctx.putImageData(image, 0, 0)
    this.refresh()
  }
  clear() {
    if (!this.hasInk || this.isDrawing) return
    this.snapshot()
    this.ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    this.refresh()
  }
  destroy() { this.abort.abort() }
}

/** Paper pixels, immutable stamp mask, and transient cursor are separate layers. */
export class StampEngine {
  private ctx: CanvasRenderingContext2D
  private overlayCtx: CanvasRenderingContext2D
  private mask = makeCanvas(DESIGN_SIZE, DESIGN_SIZE)
  private history: { pixels: ImageData; count: number }[] = []
  private pointer: number | null = null
  private pose: Pose = { x: 0, y: 0, angle: 0 }
  private visible = false
  private frame = 0
  private lastTime = 0
  private keys = new Set<string>()
  private abort = new AbortController()
  size = 180
  count = 0
  enabled = false

  constructor(readonly paper: HTMLCanvasElement, readonly overlay: HTMLCanvasElement, private changed: () => void) {
    paper.width = overlay.width = PAPER_WIDTH
    paper.height = overlay.height = PAPER_HEIGHT
    this.ctx = context(paper)
    this.overlayCtx = context(overlay)
    const options = { signal: this.abort.signal }
    overlay.addEventListener('pointerdown', this.down, options)
    overlay.addEventListener('pointermove', this.move, options)
    overlay.addEventListener('pointerup', this.up, options)
    overlay.addEventListener('pointercancel', this.up, options)
    overlay.addEventListener('lostpointercapture', this.up, options)
    overlay.addEventListener('pointerleave', this.leave, options)
    overlay.addEventListener('wheel', this.wheel, { ...options, passive: false })
    window.addEventListener('keydown', this.keydown, options)
    window.addEventListener('keyup', this.keyup, options)
    window.addEventListener('blur', this.finish, options)
    document.addEventListener('visibilitychange', this.visibility, options)
  }

  get canUndo() { return this.history.length > 0 }
  get isPressed() { return this.pointer !== null }
  get angle() { return this.pose.angle }
  setStamp(original: HTMLCanvasElement) {
    const ctx = context(this.mask)
    ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(original, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    // A fixed, very light rubber grain. No random displacement of the user's shape.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    let seed = 713
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 6500; i++) ctx.fillRect(random() * DESIGN_SIZE, random() * DESIGN_SIZE, 0.7, 0.7)
    ctx.globalCompositeOperation = 'source-over'
    this.preview()
  }
  private snapshot() {
    this.history.push({ pixels: this.ctx.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT), count: this.count })
    // Fixed bound: about 104 MB maximum of uncompressed paper snapshots.
    if (this.history.length > 12) this.history.shift()
  }
  private deposit(pose: Pose, opacity: number) {
    if (opacity <= 0) return
    this.ctx.save()
    this.ctx.translate(pose.x, pose.y)
    this.ctx.rotate(pose.angle)
    this.ctx.globalAlpha = opacity
    this.ctx.drawImage(this.mask, -this.size / 2, -this.size / 2, this.size, this.size)
    this.ctx.restore()
  }
  private travel(next: Pose) {
    const previous = this.pose
    if (this.isPressed) {
      const { steps, alpha } = sweep(previous, next, this.size)
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        this.deposit({
          x: previous.x + (next.x - previous.x) * t,
          y: previous.y + (next.y - previous.y) * t,
          angle: previous.angle + (next.angle - previous.angle) * t,
        }, alpha)
      }
    }
    this.pose = next
    this.preview()
  }
  private down = (e: PointerEvent) => {
    if (!this.enabled || e.button !== 0 || this.isPressed) return
    e.preventDefault()
    this.overlay.focus({ preventScroll: true })
    this.snapshot()
    this.pointer = e.pointerId
    this.overlay.setPointerCapture(e.pointerId)
    this.pose = { ...pointOn(this.overlay, e), angle: this.pose.angle }
    this.visible = true
    this.deposit(this.pose, 0.16)
    this.lastTime = performance.now()
    this.frame = requestAnimationFrame(this.tick)
    this.overlay.dataset.pressed = 'true'
    this.changed()
    this.preview()
  }
  private move = (e: PointerEvent) => {
    if (!this.enabled || (this.isPressed && e.pointerId !== this.pointer)) return
    this.visible = true
    const samples = e.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [e]) {
      this.travel({ ...pointOn(this.overlay, sample), angle: this.pose.angle })
    }
  }
  private tick = (now: number) => {
    if (!this.isPressed) return
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    const direction = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'))
    if (direction) this.travel({ ...this.pose, angle: this.pose.angle + direction * dt * 2.2 })
    this.deposit(this.pose, -Math.expm1(-0.58 * dt))
    this.frame = requestAnimationFrame(this.tick)
  }
  private wheel = (e: WheelEvent) => {
    if (!this.enabled || !this.isPressed) return
    e.preventDefault()
    const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 500 : 1
    // Limit extreme wheel bursts; preserve both directions and fine trackpad input.
    const rotation = Math.max(-0.65, Math.min(0.65, e.deltaY * units * 0.006))
    this.travel({ ...this.pose, angle: this.pose.angle + rotation })
  }
  private keydown = (e: KeyboardEvent) => {
    if (!this.enabled || !this.isPressed || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    this.keys.add(e.key)
  }
  private keyup = (e: KeyboardEvent) => { this.keys.delete(e.key) }
  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return
    const bounds = this.overlay.getBoundingClientRect()
    this.visible = e.clientX >= bounds.left && e.clientX <= bounds.right && e.clientY >= bounds.top && e.clientY <= bounds.bottom && e.pointerType !== 'touch'
    this.finish()
  }
  private leave = () => { if (!this.isPressed) { this.visible = false; this.preview() } }
  private visibility = () => { if (document.hidden) this.finish() }
  finish = () => {
    const id = this.pointer
    this.pointer = null
    this.keys.clear()
    cancelAnimationFrame(this.frame)
    this.overlay.dataset.pressed = 'false'
    if (id !== null) {
      this.count++
      if (this.overlay.hasPointerCapture(id)) this.overlay.releasePointerCapture(id)
      this.changed()
    }
    this.preview()
  }
  hide() { this.finish(); this.visible = false; this.preview() }
  preview() {
    const ctx = this.overlayCtx
    ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    if (!this.visible || !this.enabled) return
    ctx.save()
    ctx.translate(this.pose.x, this.pose.y)
    ctx.rotate(this.pose.angle)
    const scale = this.isPressed ? 1 : 1.045
    ctx.scale(scale, scale)
    ctx.globalAlpha = this.isPressed ? 0.15 : 0.45
    if (!this.isPressed) { ctx.shadowColor = '#4b221f55'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7 }
    ctx.drawImage(this.mask, -this.size / 2, -this.size / 2, this.size, this.size)
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = this.isPressed ? 0.45 : 0.28
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    const r = this.size / 2 + 10
    const corner = 12
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.moveTo(x * r, y * (r - corner)); ctx.lineTo(x * r, y * r); ctx.lineTo(x * (r - corner), y * r); ctx.stroke()
    }
    ctx.restore()
  }
  undo() {
    if (this.isPressed) return
    const entry = this.history.pop()
    if (!entry) return
    this.ctx.putImageData(entry.pixels, 0, 0)
    this.count = entry.count
    this.changed()
  }
  clear() {
    if (this.isPressed || this.count === 0) return
    this.snapshot()
    this.ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    this.count = 0
    this.changed()
  }
  async exportPNG() {
    const output = makeCanvas(PAPER_WIDTH, PAPER_HEIGHT)
    const ctx = context(output)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    ctx.drawImage(this.paper, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Could not create the PNG.')), 'image/png'))
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'make-your-mark.png'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  destroy() { this.finish(); this.abort.abort() }
}
