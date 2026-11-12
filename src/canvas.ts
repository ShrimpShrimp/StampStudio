import { drawDocument } from './document'

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

export function pointOn(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }): Point {
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
    const start = pointOn(this.canvas, e)
    if (Math.hypot(start.x - DESIGN_SIZE / 2, start.y - DESIGN_SIZE / 2) > DESIGN_SIZE * .47) return
    this.snapshot()
    this.pointer = e.pointerId
    this.canvas.setPointerCapture(e.pointerId)
    this.previous = pointOn(this.canvas, e)
    this.stroke(this.previous, this.previous)
  }
  private stroke(from: Point, to: Point) {
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(DESIGN_SIZE / 2, DESIGN_SIZE / 2, DESIGN_SIZE * .47, 0, Math.PI * 2)
    this.ctx.clip()
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
    this.ctx.restore()
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


type ContactMode = 'landing' | 'pressure' | 'slide' | null
const WET_COLS = 90
const WET_ROWS = 60

type PaperSnapshot = {
  pixels: ImageData
  wet: Float32Array
  count: number
  sheet: number
  spoiled: boolean
}

/** A click lands the seal; a deliberate initial drag slides it. Placed presses rock. */
export class StampEngine {
  private ctx: CanvasRenderingContext2D
  private overlayCtx: CanvasRenderingContext2D
  private damageCtx: CanvasRenderingContext2D
  private mask = makeCanvas(DESIGN_SIZE, DESIGN_SIZE)
  private contactMask = makeCanvas(DESIGN_SIZE, DESIGN_SIZE)
  private contactCtx = context(this.contactMask)
  private bleed = makeCanvas(450, 300)
  private moisture = makeCanvas(WET_COLS, WET_ROWS)
  private patches: HTMLCanvasElement[] = []
  private history: PaperSnapshot[] = []
  private wet = new Float32Array(WET_COLS * WET_ROWS)
  private pointer: number | null = null
  private interaction: ContactMode = null
  private pose: Pose = { x: 0, y: 0, angle: 0 }
  private origin: Point = { x: 0, y: 0 }
  private pressure: Point = { x: 0, y: 0 }
  private hover: Point | null = null
  private visible = false
  private contact = false
  private frame = 0
  private lastTime = 0
  private damageTime = 0
  private distance = 0
  private landing = 0
  private settlePhase = 0
  private slideSpeed = 0
  private turnSpeed = 0
  private lastSlideTime = 0
  private lastTurnTime = 0
  private lastWetBucket = 0
  private keys = new Set<string>()
  private abort = new AbortController()
  size = 320
  count = 0
  sheet = 1
  placed = false
  spoiled = false
  enabled = false
  wetness = 0

  constructor(
    readonly paper: HTMLCanvasElement,
    readonly overlay: HTMLCanvasElement,
    readonly background: HTMLCanvasElement,
    readonly damage: HTMLCanvasElement,
    private changed: () => void,
  ) {
    for (const canvas of [paper, overlay, background, damage]) {
      canvas.width = PAPER_WIDTH; canvas.height = PAPER_HEIGHT
    }
    this.ctx = context(paper)
    this.overlayCtx = context(overlay)
    this.damageCtx = context(damage)
    drawDocument(context(background), this.sheet)
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
  get isPressed() { return this.pointer !== null }
  get isSliding() { return this.interaction === 'slide' }
  get angle() { return ((this.pose.angle * 180 / Math.PI + 180) % 360 + 360) % 360 - 180 }

  private sync() {
    this.overlay.dataset.placed = String(this.placed)
    this.overlay.dataset.pressed = String(this.isPressed)
    this.overlay.dataset.sliding = String(this.isSliding)
    this.overlay.dataset.angle = String(Math.round(this.angle))
    this.overlay.dataset.condition = this.spoiled ? 'soaked' : this.wetness >= .48 ? 'damp' : 'dry'
    this.changed()
  }

  setStamp(original: HTMLCanvasElement) {
    const ctx = context(this.mask)
    ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(original, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = INK; ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,.25)'
    let seed = 713
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
    for (let i = 0; i < 6500; i++) ctx.fillRect(random() * DESIGN_SIZE, random() * DESIGN_SIZE, .8, .8)
    ctx.globalCompositeOperation = 'source-over'
    this.patches = Array.from({ length: 10 }, (_, index) => this.makePatch(index))
    this.preview()
  }

  /** Broad coherent dry/wet regions, rather than uniformly faded copies. */
  private makePatch(seed: number) {
    const field = makeCanvas(128, 128)
    const ctx = context(field), pixels = ctx.createImageData(128, 128)
    const hash = (x: number, y: number) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 93.3) * 43758.5453
      return value - Math.floor(value)
    }
    const smooth = (t: number) => t * t * (3 - 2 * t)
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const gx = x / 25, gy = y / 25
      const ix = Math.floor(gx), iy = Math.floor(gy), tx = smooth(gx - ix), ty = smooth(gy - iy)
      const top = hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx
      const bottom = hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx
      const noise = top * (1 - ty) + bottom * ty
      const coverage = smooth(Math.max(0, Math.min(1, (noise - .28) / .36)))
      const at = (y * 128 + x) * 4
      pixels.data[at] = pixels.data[at + 1] = pixels.data[at + 2] = 255
      pixels.data[at + 3] = coverage * 255
    }
    ctx.putImageData(pixels, 0, 0)
    const patch = makeCanvas(DESIGN_SIZE, DESIGN_SIZE), out = context(patch)
    out.drawImage(this.mask, 0, 0)
    out.globalCompositeOperation = 'destination-in'
    out.drawImage(field, 0, 0, DESIGN_SIZE, DESIGN_SIZE)
    out.globalCompositeOperation = 'source-over'
    return patch
  }

  private snapshot() {
    this.history.push({ pixels: this.ctx.getImageData(0, 0, PAPER_WIDTH, PAPER_HEIGHT), wet: this.wet.slice(), count: this.count, sheet: this.sheet, spoiled: this.spoiled })
    if (this.history.length > 10) this.history.shift()
  }

  private local(point: Point): Point {
    const dx = point.x - this.pose.x, dy = point.y - this.pose.y
    const c = Math.cos(this.pose.angle), s = Math.sin(this.pose.angle)
    return { x: dx * c + dy * s, y: -dx * s + dy * c }
  }
  private hits(point: Point) { return Math.hypot(point.x - this.pose.x, point.y - this.pose.y) <= this.size / 2 + 12 }

  private updateContact() {
    this.contact = this.hits(this.pressure)
    const local = this.local(this.pressure)
    const x = (local.x / this.size + .5) * DESIGN_SIZE, y = (local.y / this.size + .5) * DESIGN_SIZE
    const ctx = this.contactCtx
    ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(this.mask, 0, 0)
    const field = ctx.createRadialGradient(x, y, 0, x, y, DESIGN_SIZE * .53)
    field.addColorStop(0, '#000'); field.addColorStop(.2, '#000000f5')
    field.addColorStop(.55, '#00000080'); field.addColorStop(.85, '#00000014'); field.addColorStop(1, '#00000000')
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = field
    ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
    ctx.globalCompositeOperation = 'source-over'
  }

  private deposit(opacity: number, patchy = false) {
    if (this.spoiled || opacity <= 0 || (!patchy && !this.contact)) return
    this.ctx.save()
    this.ctx.translate(this.pose.x, this.pose.y); this.ctx.rotate(this.pose.angle)
    this.ctx.globalAlpha = opacity
    if (patchy) {
      const phase = this.landing + this.distance / (this.size * .38) + this.settlePhase
      const index = Math.floor(phase), mix = phase - index
      const a = this.patches[index % this.patches.length]
      const b = this.patches[(index + 1) % this.patches.length]
      if (a) {
        this.ctx.globalAlpha = opacity * (1 - mix)
        this.ctx.drawImage(a, -this.size / 2, -this.size / 2, this.size, this.size)
        this.ctx.globalAlpha = opacity * mix
        this.ctx.drawImage(b, -this.size / 2, -this.size / 2, this.size, this.size)
      }
    } else this.ctx.drawImage(this.contactMask, -this.size / 2, -this.size / 2, this.size, this.size)
    // Keep ink hue stable while retaining the accumulated alpha and previous artwork.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    const r = this.size * .74 + 3
    this.ctx.beginPath(); this.ctx.rect(this.pose.x - r, this.pose.y - r, r * 2, r * 2); this.ctx.clip()
    this.ctx.globalAlpha = 1; this.ctx.globalCompositeOperation = 'source-in'; this.ctx.fillStyle = INK
    this.ctx.fillRect(this.pose.x - r - 2, this.pose.y - r - 2, r * 2 + 4, r * 2 + 4)
    this.ctx.restore()
  }

  private moisten(amount: number) {
    if (this.spoiled || (this.interaction === 'pressure' && !this.contact)) return
    const point = this.interaction === 'pressure' ? this.pressure : this.pose
    const radius = this.size * .42
    const cellX = PAPER_WIDTH / WET_COLS, cellY = PAPER_HEIGHT / WET_ROWS
    const minX = Math.max(0, Math.floor((point.x - radius) / cellX)), maxX = Math.min(WET_COLS - 1, Math.ceil((point.x + radius) / cellX))
    const minY = Math.max(0, Math.floor((point.y - radius) / cellY)), maxY = Math.min(WET_ROWS - 1, Math.ceil((point.y + radius) / cellY))
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot((x + .5) * cellX - point.x, (y + .5) * cellY - point.y) / radius
      if (distance >= 1) continue
      const index = y * WET_COLS + x
      this.wet[index] += amount * (1 - distance * distance)
      this.wetness = Math.max(this.wetness, this.wet[index])
    }
    const bucket = Math.round(this.wetness * 100)
    if (bucket !== this.lastWetBucket) { this.lastWetBucket = bucket; this.sync() }
    if (this.wetness >= 1) {
      this.spoiled = true
      this.finish()
      this.placed = false; this.visible = false; this.hover = null
      this.renderDamage(); this.sync(); this.preview()
    }
  }

  private renderDamage() {
    const ctx = this.damageCtx
    ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    if (this.wetness >= .3) {
      // Low-resolution diffusion keeps the live bleed inexpensive. The moisture
      // field confines it to damp areas, and the original artwork stays intact.
      const field = context(this.moisture), pixels = field.createImageData(WET_COLS, WET_ROWS)
      for (let i = 0; i < this.wet.length; i++) {
        pixels.data[i * 4 + 3] = Math.max(0, Math.min(190, (this.wet[i] - .25) * 255))
      }
      field.putImageData(pixels, 0, 0)
      const bleed = context(this.bleed)
      bleed.clearRect(0, 0, 450, 300)
      bleed.globalCompositeOperation = 'source-over'
      bleed.filter = `blur(${1 + this.wetness * 2.5}px)`
      bleed.drawImage(this.paper, 0, 0, 450, 300)
      bleed.filter = 'none'
      bleed.globalCompositeOperation = 'destination-in'
      bleed.drawImage(this.moisture, 0, 0, 450, 300)
      bleed.globalCompositeOperation = 'source-over'
      ctx.drawImage(this.bleed, 0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    }
    for (let y = 0; y < WET_ROWS; y++) for (let x = 0; x < WET_COLS; x++) {
      const wet = this.wet[y * WET_COLS + x]
      if (wet < .42) continue
      const cx = (x + .5) * PAPER_WIDTH / WET_COLS, cy = (y + .5) * PAPER_HEIGHT / WET_ROWS
      const radius = 20 + wet * 23
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      halo.addColorStop(0, `rgba(130,65,53,${Math.min(.13, (wet - .42) * .13)})`)
      halo.addColorStop(.6, 'rgba(161,96,71,.018)'); halo.addColorStop(1, 'rgba(161,96,71,0)')
      ctx.fillStyle = halo; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
    if (this.spoiled) {
      ctx.save(); ctx.translate(1435, 290); ctx.rotate(-.11)
      ctx.strokeStyle = '#a52d2b99'; ctx.fillStyle = '#a52d2b'; ctx.lineWidth = 4
      ctx.strokeRect(-170, -38, 340, 76); ctx.textAlign = 'center'; ctx.font = 'bold 29px monospace'
      ctx.fillText('SOAKED THROUGH', 0, 10); ctx.restore()
    }
    this.damageTime = performance.now()
  }

  // Speeds use stamp widths per second, including the rim's motion during a turn.
  // Decay releases a stale velocity promptly when the user stops moving.
  private motionSpeed(now: number, kind: 'slide' | 'turn') {
    const speed = kind === 'slide' ? this.slideSpeed : this.turnSpeed
    const last = kind === 'slide' ? this.lastSlideTime : this.lastTurnTime
    return speed * Math.exp(-Math.max(0, (now - last) / 1000 - .025) / .08)
  }

  private transferFactor(speed: number) {
    return .06 + .94 / (1 + Math.pow(speed / 1.8, 1.6))
  }

  private slideTo(point: Point) {
    const now = performance.now()
    const previous = { ...this.pose }
    const length = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (length === 0) return
    const elapsed = Math.max(1 / 240, Math.min(.2, (now - this.lastSlideTime) / 1000))
    this.slideSpeed = length / this.size / elapsed
    this.lastSlideTime = now
    const transfer = this.transferFactor(Math.hypot(this.slideSpeed, this.motionSpeed(now, 'turn')))
    const steps = Math.max(1, Math.ceil(length / (this.size * .045)))
    const opacity = -Math.expm1(-length / this.size * 24 * transfer / steps)
    for (let i = 1; i <= steps; i++) {
      this.pose.x = previous.x + (point.x - previous.x) * i / steps
      this.pose.y = previous.y + (point.y - previous.y) * i / steps
      this.distance += length / steps
      this.deposit(opacity, true)
      this.moisten(length / this.size * .035 * transfer / steps)
      if (this.spoiled) break
    }
  }

  private turn(rotation: number, now = performance.now(), frameElapsed?: number) {
    if (this.spoiled) return
    const active = this.isPressed
    let transfer = 1
    if (active) {
      const elapsed = Math.max(1 / 240, frameElapsed ?? Math.min(.2, (now - this.lastTurnTime) / 1000))
      this.turnSpeed = Math.abs(rotation) * .5 / elapsed
      this.lastTurnTime = now
      transfer = this.transferFactor(Math.hypot(this.turnSpeed, this.isSliding ? this.motionSpeed(now, 'slide') : 0))
    }
    const steps = active ? Math.max(1, Math.ceil(Math.abs(rotation) / .035)) : 1
    for (let i = 0; i < steps; i++) {
      this.pose.angle += rotation / steps
      if (active) {
        this.updateContact()
        this.deposit(-Math.expm1(-Math.abs(rotation) * 1.1 * transfer / steps), this.interaction !== 'pressure')
      }
    }
    this.pose.angle %= Math.PI * 2
    this.sync(); this.preview()
  }
  setAngle(degrees: number) { if (Number.isFinite(degrees) && !this.isPressed) this.turn(degrees * Math.PI / 180 - this.pose.angle) }

  private down = (e: PointerEvent) => {
    if (!this.enabled || this.spoiled || e.button !== 0 || this.isPressed) return
    e.preventDefault(); this.overlay.focus({ preventScroll: true })
    const point = pointOn(this.overlay, e)
    this.slideSpeed = this.turnSpeed = this.settlePhase = 0
    this.lastSlideTime = this.lastTurnTime = performance.now()
    this.snapshot(); this.pointer = e.pointerId; this.overlay.setPointerCapture(e.pointerId)
    this.hover = point; this.visible = true; this.origin = point
    if (this.placed && this.hits(point)) {
      this.interaction = 'pressure'; this.pressure = point
      this.updateContact(); this.deposit(.24)
    } else {
      this.pose = { ...point, angle: this.pose.angle }
      this.placed = true; this.interaction = 'landing'; this.distance = 0
      this.landing = (this.landing + 3) % this.patches.length
      this.deposit(.98, true)
    }
    this.moisten(.045)
    this.lastTime = performance.now(); this.frame = requestAnimationFrame(this.tick)
    this.sync(); this.preview()
  }

  private move = (e: PointerEvent) => {
    if (!this.enabled || this.spoiled || (this.isPressed && e.pointerId !== this.pointer)) return
    const point = pointOn(this.overlay, e)
    this.hover = point; this.visible = true
    if (this.interaction === 'landing') {
      const scale = this.overlay.getBoundingClientRect().width / PAPER_WIDTH
      if (Math.hypot(point.x - this.origin.x, point.y - this.origin.y) * scale > 8) {
        this.interaction = 'slide'; this.placed = false; this.sync()
        this.slideTo(point)
      }
    } else if (this.interaction === 'slide') this.slideTo(point)
    else if (this.interaction === 'pressure') { this.pressure = point; this.updateContact() }
    else if (!this.placed) this.pose = { ...point, angle: this.pose.angle }
    this.preview()
  }

  private tick = (now: number) => {
    if (!this.isPressed || this.spoiled) return
    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, .1))
    this.lastTime = now
    const direction = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'))
    if (direction && dt > 0) this.turn(direction * dt * 2.2, now, dt)
    const speed = Math.hypot(this.isSliding ? this.motionSpeed(now, 'slide') : 0, this.motionSpeed(now, 'turn'))
    const transfer = this.transferFactor(speed)
    if (this.isSliding) this.settlePhase += dt * .2 * transfer
    const inkRate = this.isSliding ? 2.8 : 1.3
    this.deposit(-Math.expm1(-inkRate * transfer * dt), this.interaction !== 'pressure')
    this.moisten(dt * .17 * transfer)
    if (now - this.damageTime > 100) this.renderDamage()
    if (this.isPressed && !this.spoiled) this.frame = requestAnimationFrame(this.tick)
  }

  private wheel = (e: WheelEvent) => {
    if (!this.enabled || this.spoiled) return
    e.preventDefault()
    const point = pointOn(this.overlay, e)
    this.hover = point; this.visible = true
    if (!this.placed && !this.isPressed) this.pose = { ...point, angle: this.pose.angle }
    const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 500 : 1
    this.turn(Math.max(-.65, Math.min(.65, e.deltaY * units * .006)))
  }
  private keydown = (e: KeyboardEvent) => {
    if (!this.enabled || (e.target instanceof HTMLElement && e.target.matches('input, select, textarea, button'))) return
    if (e.key === 'Escape') { e.preventDefault(); this.lift() }
    else if (['ArrowLeft', 'ArrowRight'].includes(e.key) && (this.hover || document.activeElement === this.overlay)) {
      e.preventDefault()
      if (this.isPressed) this.keys.add(e.key)
      else this.turn((e.key === 'ArrowRight' ? 1 : -1) * Math.PI / 36)
    }
  }
  private keyup = (e: KeyboardEvent) => { this.keys.delete(e.key) }
  private up = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.finish() }
  private leave = () => { this.hover = null; if (!this.isPressed && !this.placed) this.visible = false; this.preview() }
  private visibility = () => { if (document.hidden) this.finish() }

  finish = () => {
    const id = this.pointer
    this.pointer = null; this.interaction = null; this.keys.clear(); cancelAnimationFrame(this.frame)
    this.slideSpeed = this.turnSpeed = 0
    if (id !== null) {
      this.count++
      if (!this.spoiled) this.placed = true
      if (this.overlay.hasPointerCapture(id)) this.overlay.releasePointerCapture(id)
    }
    this.renderDamage(); this.sync(); this.preview()
  }
  lift() { this.finish(); this.placed = false; this.visible = false; this.hover = null; this.sync(); this.preview() }
  hide() { this.lift() }

  preview() {
    const ctx = this.overlayCtx
    ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    this.overlay.style.cursor = this.spoiled ? 'not-allowed' : this.isPressed ? 'none' : this.placed && this.hover && this.hits(this.hover) ? 'pointer' : 'crosshair'
    if ((!this.visible && !this.placed) || !this.enabled || this.spoiled) return
    const local = this.local(this.interaction === 'pressure' ? this.pressure : this.pose)
    const leanX = Math.max(-1, Math.min(1, local.x / (this.size / 2))), leanY = Math.max(-1, Math.min(1, local.y / (this.size / 2)))
    const r = this.size / 2 + 12
    ctx.save(); ctx.translate(this.pose.x, this.pose.y); ctx.rotate(this.pose.angle)
    if (this.interaction === 'pressure' && this.contact) ctx.transform(1, leanY * .025, leanX * .025, 1, 0, 0)
    ctx.shadowColor = '#39312840'; ctx.shadowBlur = this.placed ? 6 : 16
    ctx.shadowOffsetX = -leanX * 5; ctx.shadowOffsetY = this.isPressed ? 2 - leanY * 5 : this.placed ? 5 : 15
    ctx.fillStyle = this.isPressed ? '#e6bd8c18' : '#e6c29433'; ctx.strokeStyle = '#78603bdd'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = '#a88b5d99'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = this.placed ? .12 : .5
    ctx.drawImage(this.mask, -this.size / 2, -this.size / 2, this.size, this.size); ctx.globalAlpha = 1
    ctx.strokeStyle = '#8a714c'; ctx.lineWidth = 3
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 9, -r + 16); ctx.lineTo(i * 9, -r + 25); ctx.stroke()
    }
    if (this.interaction === 'pressure' && this.contact) {
      const glow = ctx.createRadialGradient(local.x, local.y, 0, local.x, local.y, this.size * .4)
      glow.addColorStop(0, '#a52d2b25'); glow.addColorStop(1, '#a52d2b00')
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, Math.PI * 2); ctx.clip()
      ctx.fillStyle = glow; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore()
      ctx.strokeStyle = INK; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(local.x, local.y, 14, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(local.x, local.y, 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = '#816a48'; ctx.font = '17px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(this.isSliding ? 'LET IT SLIDE' : this.placed ? 'WORK THE EDGES' : 'TAP TO PLACE · DRAG TO SLIDE', this.pose.x, this.pose.y + r + 30)
  }

  undo() {
    if (this.isPressed) return
    const entry = this.history.pop()
    if (!entry) return
    this.ctx.putImageData(entry.pixels, 0, 0); this.wet.set(entry.wet)
    this.count = entry.count; this.sheet = entry.sheet; this.spoiled = entry.spoiled
    this.wetness = Math.max(0, ...this.wet); this.lastWetBucket = Math.round(this.wetness * 100)
    drawDocument(context(this.background), this.sheet)
    this.lift()
  }

  freshDocument() {
    if (this.isPressed) return
    this.snapshot(); this.ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    this.wet.fill(0); this.wetness = 0; this.lastWetBucket = 0; this.spoiled = false
    this.count = 0; this.sheet++
    drawDocument(context(this.background), this.sheet); this.lift()
  }

  async exportPNG() {
    const output = makeCanvas(PAPER_WIDTH, PAPER_HEIGHT), ctx = context(output)
    ctx.drawImage(this.background, 0, 0); ctx.drawImage(this.damage, 0, 0); ctx.drawImage(this.paper, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Could not create the PNG.')), 'image/png'))
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = 'make-your-mark.png'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  destroy() { this.finish(); this.abort.abort() }
}
