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

/** Placement is separate from contact. Pressure changes coverage at a fixed center. */
export class StampEngine {
  private ctx: CanvasRenderingContext2D
  private overlayCtx: CanvasRenderingContext2D
  private mask = makeCanvas(DESIGN_SIZE, DESIGN_SIZE)
  private contactMask = makeCanvas(DESIGN_SIZE, DESIGN_SIZE)
  private contactCtx = context(this.contactMask)
  private history: { pixels: ImageData; count: number }[] = []
  private pointer: number | null = null
  private interaction: 'place' | 'pressure' | null = null
  private pose: Pose = { x: 0, y: 0, angle: 0 }
  private pressure: Point = { x: 0, y: 0 }
  private hover: Point | null = null
  private visible = false
  private contact = false
  private frame = 0
  private lastTime = 0
  private keys = new Set<string>()
  private abort = new AbortController()
  size = 300
  count = 0
  placed = false
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
    this.sync()
  }

  get canUndo() { return this.history.length > 0 }
  get isPressed() { return this.interaction === 'pressure' }
  get angle() { return this.pose.angle }

  private sync() {
    this.overlay.dataset.placed = String(this.placed)
    this.overlay.dataset.pressed = String(this.isPressed)
    this.changed()
  }

  setStamp(original: HTMLCanvasElement) {
    const ctx = context(this.mask)
    ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(original, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
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
    if (this.history.length > 12) this.history.shift()
  }

  private local(point: Point): Point {
    const dx = point.x - this.pose.x, dy = point.y - this.pose.y
    const c = Math.cos(this.pose.angle), s = Math.sin(this.pose.angle)
    return { x: dx * c + dy * s, y: -dx * s + dy * c }
  }

  private hits(point: Point) {
    const local = this.local(point)
    const half = this.size / 2 + 10
    return Math.abs(local.x) <= half && Math.abs(local.y) <= half
  }

  private updateContact() {
    this.contact = this.hits(this.pressure)
    const local = this.local(this.pressure)
    const x = (local.x / this.size + .5) * DESIGN_SIZE
    const y = (local.y / this.size + .5) * DESIGN_SIZE
    const ctx = this.contactCtx
    ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.mask, 0, 0)
    // Only nearby rubber touches the paper. Distant edges receive no ink.
    const field = ctx.createRadialGradient(x, y, 0, x, y, DESIGN_SIZE * .56)
    field.addColorStop(0, 'rgba(0,0,0,1)')
    field.addColorStop(.2, 'rgba(0,0,0,.96)')
    field.addColorStop(.55, 'rgba(0,0,0,.5)')
    field.addColorStop(.85, 'rgba(0,0,0,.08)')
    field.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = field
    ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
  }

  private deposit(opacity: number) {
    if (!this.contact || opacity <= 0) return
    this.ctx.save()
    this.ctx.translate(this.pose.x, this.pose.y)
    this.ctx.rotate(this.pose.angle)
    this.ctx.globalAlpha = opacity
    this.ctx.drawImage(this.contactMask, -this.size / 2, -this.size / 2, this.size, this.size)
    // Very low-alpha repeated deposits can quantize RGB toward black. Keep the
    // accumulated coverage, then restore the intended ink color within this face.
    this.ctx.beginPath()
    this.ctx.rect(-this.size / 2, -this.size / 2, this.size, this.size)
    this.ctx.clip()
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-in'
    this.ctx.fillStyle = INK
    this.ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size)
    this.ctx.restore()
  }

  private turn(rotation: number) {
    const steps = Math.max(1, Math.ceil(Math.abs(rotation) / .035))
    const alpha = -Math.expm1(-Math.abs(rotation) * .7 / steps)
    for (let i = 0; i < steps; i++) {
      this.pose.angle += rotation / steps
      this.updateContact()
      this.deposit(alpha)
    }
    // Normalize only after the interpolated turn so the next turn takes the short path.
    this.pose.angle %= Math.PI * 2
    this.preview()
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled || e.button !== 0 || this.pointer !== null) return
    e.preventDefault()
    this.overlay.focus({ preventScroll: true })
    const point = pointOn(this.overlay, e)
    this.hover = point
    this.visible = true
    this.pointer = e.pointerId
    this.overlay.setPointerCapture(e.pointerId)
    if (!this.placed || !this.hits(point)) {
      // The placement press never inks, even when held or moved before release.
      this.pose = { ...point, angle: this.pose.angle }
      this.placed = true
      this.interaction = 'place'
    } else {
      this.snapshot()
      this.interaction = 'pressure'
      this.pressure = point
      this.updateContact()
      this.deposit(.2)
      this.lastTime = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
    this.sync()
    this.preview()
  }

  private move = (e: PointerEvent) => {
    if (!this.enabled || (this.pointer !== null && e.pointerId !== this.pointer)) return
    const point = pointOn(this.overlay, e)
    this.hover = point
    this.visible = true
    if (this.isPressed) {
      this.pressure = point
      this.updateContact()
    } else if (!this.placed) {
      this.pose = { ...point, angle: this.pose.angle }
    }
    // Moving a placed stamp's pressure point never moves its center or paints a trail.
    this.preview()
  }

  private tick = (now: number) => {
    if (!this.isPressed) return
    const dt = Math.min((now - this.lastTime) / 1000, .1)
    this.lastTime = now
    const direction = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'))
    if (direction) this.turn(direction * dt * 2.2)
    this.deposit(-Math.expm1(-1.15 * dt))
    this.frame = requestAnimationFrame(this.tick)
  }

  private wheel = (e: WheelEvent) => {
    if (!this.enabled || !this.isPressed) return
    e.preventDefault()
    const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 500 : 1
    this.turn(Math.max(-.65, Math.min(.65, e.deltaY * units * .006)))
  }

  private keydown = (e: KeyboardEvent) => {
    if (!this.enabled) return
    if (e.key === 'Escape') {
      e.preventDefault()
      this.lift()
    } else if (this.isPressed && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      this.keys.add(e.key)
    }
  }
  private keyup = (e: KeyboardEvent) => { this.keys.delete(e.key) }
  private up = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.finish() }
  private leave = () => {
    this.hover = null
    if (this.pointer === null && !this.placed) this.visible = false
    this.preview()
  }
  private visibility = () => { if (document.hidden) this.finish() }

  finish = () => {
    const id = this.pointer
    const wasPressure = this.isPressed
    this.pointer = null
    this.interaction = null
    this.keys.clear()
    cancelAnimationFrame(this.frame)
    if (id !== null && this.overlay.hasPointerCapture(id)) this.overlay.releasePointerCapture(id)
    if (wasPressure) this.count++
    this.sync()
    this.preview()
  }

  lift() {
    this.finish()
    this.placed = false
    this.visible = false
    this.hover = null
    this.sync()
    this.preview()
  }

  hide() { this.lift() }

  preview() {
    const ctx = this.overlayCtx
    ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    this.overlay.style.cursor = this.isPressed ? 'none' : this.placed && this.hover && this.hits(this.hover) ? 'pointer' : 'crosshair'
    if ((!this.visible && !this.placed) || !this.enabled) return
    const local = this.local(this.isPressed ? this.pressure : this.pose)
    const leanX = Math.max(-1, Math.min(1, local.x / (this.size / 2)))
    const leanY = Math.max(-1, Math.min(1, local.y / (this.size / 2)))
    const r = this.size / 2 + 10
    ctx.save()
    ctx.translate(this.pose.x, this.pose.y)
    ctx.rotate(this.pose.angle)
    if (this.isPressed && this.contact) ctx.transform(1, leanY * .018, leanX * .018, 1, 0, 0)
    ctx.shadowColor = '#4b382c30'
    ctx.shadowBlur = this.placed ? 5 : 15
    ctx.shadowOffsetX = this.isPressed ? -leanX * 4 : 0
    ctx.shadowOffsetY = this.isPressed ? 2 - leanY * 4 : this.placed ? 4 : 12
    ctx.fillStyle = this.isPressed ? '#ddcbb111' : '#e0d2b91c'
    ctx.strokeStyle = this.isPressed ? '#8b5942aa' : '#93796199'
    ctx.lineWidth = this.placed ? 2.5 : 2
    ctx.beginPath()
    ctx.roundRect(-r, -r, r * 2, r * 2, 7)
    ctx.fill()
    ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = this.placed ? .13 : .4
    ctx.drawImage(this.mask, -this.size / 2, -this.size / 2, this.size, this.size)
    ctx.globalAlpha = 1
    // Grip marks distinguish the carrier from the ink image.
    ctx.strokeStyle = '#9c826377'
    ctx.lineWidth = 2
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 9, side * (r - 8)); ctx.lineTo(i * 9, side * (r - 14)); ctx.stroke()
      }
    }
    if (this.isPressed && this.contact) {
      const glow = ctx.createRadialGradient(local.x, local.y, 0, local.x, local.y, this.size * .42)
      glow.addColorStop(0, '#a52d2b20'); glow.addColorStop(1, '#a52d2b00')
      ctx.save()
      ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.clip()
      ctx.fillStyle = glow; ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.restore()
      ctx.strokeStyle = '#a52d2b99'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(local.x, local.y, 13, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = INK
      ctx.beginPath(); ctx.arc(local.x, local.y, 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    if (!this.isPressed) {
      ctx.save()
      ctx.fillStyle = '#8f7b65'
      ctx.font = '17px "DM Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(this.placed ? 'PRESS AROUND THE FACE' : 'CLICK TO PLACE', this.pose.x, this.pose.y + r + 34)
      ctx.restore()
    }
  }

  undo() {
    if (this.pointer !== null) return
    const entry = this.history.pop()
    if (!entry) return
    this.ctx.putImageData(entry.pixels, 0, 0)
    this.count = entry.count
    this.sync()
  }

  clear() {
    if (this.pointer !== null || this.count === 0) return
    this.snapshot()
    this.ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    this.count = 0
    this.lift()
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
