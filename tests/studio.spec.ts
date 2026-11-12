import { expect, test, type Page, type Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error('Canvas is not visible')
  return b
}
async function image(locator: Locator) { return locator.evaluate((node: HTMLCanvasElement) => node.toDataURL()) }
async function stats(locator: Locator) {
  return locator.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
    let alpha = 0, area = 0, dark = 0, thin = 0
    for (let i = 3; i < data.length; i += 4) {
      alpha += data[i]
      if (data[i]) area++
      if (data[i] >= 180) dark++
      if (data[i] > 5 && data[i] < 90) thin++
    }
    return { alpha, area, dark, thin }
  })
}
async function design(page: Page) {
  const canvas = page.getByLabel('Shape your personal stamp on the circular rubber face', { exact: true })
  const b = await box(canvas)
  await page.mouse.move(b.x + b.width * .82, b.y + b.height * .5)
  await page.mouse.down()
  for (let i = 1; i <= 40; i++) {
    const angle = i / 40 * Math.PI * 2
    await page.mouse.move(b.x + b.width * (.5 + Math.cos(angle) * .32), b.y + b.height * (.5 + Math.sin(angle) * .32))
  }
  await page.mouse.up()
  return canvas
}
async function studio(page: Page) {
  await design(page)
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  const cursor = page.getByLabel('Stamping surface:', { exact: false })
  const paper = page.getByLabel('Your stamped composition', { exact: true })
  return { cursor, paper, b: await box(cursor) }
}
async function land(page: Page, b: { x: number; y: number; width: number; height: number }, fx = .7, fy = .7) {
  const x = b.x + b.width * fx, y = b.y + b.height * fy
  await page.mouse.click(x, y)
  return { x, y, px: fx * 1800, py: fy * 1200, size: 320 * b.width / 1800 }
}

test.beforeEach(async ({ page }) => { await page.goto('./') })

test('circular rubber editor preserves the personal symbol, restore, undo, and width choices', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Use this stamp' })).toBeDisabled()
  const canvas = await design(page), original = await image(canvas)
  const originalPixels = await stats(canvas), b = await box(canvas)
  expect(originalPixels.area).toBeGreaterThan(5000)
  await page.getByRole('button', { name: 'Bold carving tool', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Bold carving tool', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.mouse.move(b.x + b.width * .75, b.y + b.height * .5)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * .9, b.y + b.height * .5, { steps: 8 })
  await page.mouse.up()
  expect((await stats(canvas)).area).toBeLessThan(originalPixels.area)
  await page.getByRole('button', { name: 'Undo shaping', exact: true }).click()
  expect(await image(canvas)).toBe(original)
  await page.getByRole('button', { name: 'Clear stamp design', exact: true }).click()
  expect((await stats(canvas)).area).toBe(0)
  await page.getByRole('button', { name: 'Undo shaping', exact: true }).click()
  expect(await image(canvas)).toBe(original)
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  await page.getByRole('button', { name: 'Edit stamp', exact: true }).click()
  expect(await image(canvas)).toBe(original)
})

test('a light landing leaves both strong and thin patches immediately, and remains anchored', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  await land(page, b)
  const ink = await stats(paper)
  expect(ink.dark).toBeGreaterThan(50)
  expect(ink.thin).toBeGreaterThan(50)
  await expect(cursor).toHaveAttribute('data-placed', 'true')
  const placed = await image(cursor)
  await page.mouse.move(b.x + b.width * .2, b.y + b.height * .2)
  expect(await image(cursor)).toBe(placed)
  await expect(page.getByRole('slider', { name: 'Stamp size', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
  await expect(cursor).toHaveAttribute('data-placed', 'false')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await stats(paper)).area).toBe(0)
})

test('pressing a dry area fills it locally and stops changing after release', async ({ page }) => {
  const { paper, b } = await studio(page)
  const p = await land(page, b)
  const dry = await page.evaluate(({ px, py }) => {
    const source = document.querySelector<HTMLCanvasElement>('canvas[aria-label^="Shape your personal"]')!
    const target = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Your stamped composition"]')!
    const mask = source.getContext('2d')!.getImageData(0, 0, 512, 512).data
    const ctx = target.getContext('2d')!
    for (let y = 50; y < 462; y += 3) for (let x = 50; x < 462; x += 3) {
      if (mask[(y * 512 + x) * 4 + 3] < 200) continue
      const dx = (x / 512 - .5) * 320, dy = (y / 512 - .5) * 320
      const alpha = ctx.getImageData(Math.round(px + dx), Math.round(py + dy), 1, 1).data[3]
      if (alpha < 70) return { dx, dy }
    }
    throw new Error('The first impression had no dry area to work on')
  }, p)
  const sample = (dx: number, dy: number) => paper.evaluate((node: HTMLCanvasElement, point) => node.getContext('2d')!.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data[3], { x: p.px + dx, y: p.py + dy })
  const before = await sample(dry.dx, dry.dy)
  const farBefore = await sample(-dry.dx, -dry.dy)
  await page.mouse.move(p.x + dry.dx * b.width / 1800, p.y + dry.dy * b.height / 1200)
  await page.mouse.down()
  await page.waitForTimeout(300)
  const early = await sample(dry.dx, dry.dy)
  await page.waitForTimeout(700)
  const later = await sample(dry.dx, dry.dy)
  await page.mouse.up()
  expect(early).toBeGreaterThan(before)
  expect(later).toBeGreaterThan(early)
  expect(await sample(-dry.dx, -dry.dy)).toBe(farBefore)
  const released = await image(paper)
  await page.waitForTimeout(200)
  expect(await image(paper)).toBe(released)
})

test('dragging from a lifted stamp makes a continuous uneven trail and undoes as one contact', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  await page.mouse.move(b.x + b.width * .15, b.y + b.height * .55)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * .85, b.y + b.height * .55)
  await expect(cursor).toHaveAttribute('data-sliding', 'true')
  await page.mouse.up()
  await expect(cursor).toHaveAttribute('data-placed', 'true')
  const filledColumns = await paper.evaluate((node: HTMLCanvasElement) => {
    const ctx = node.getContext('2d')!
    let filled = 0, total = 0
    for (let x = 350; x < 1450; x += 20) {
      total++
      if (ctx.getImageData(x, 0, 1, node.height).data.some((v, i) => i % 4 === 3 && v > 0)) filled++
    }
    return filled / total
  })
  expect(filledColumns).toBeGreaterThan(.9)
  const ink = await stats(paper)
  expect(ink.dark).toBeGreaterThan(50)
  expect(ink.thin).toBeGreaterThan(50)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await stats(paper)).area).toBe(0)
  await expect(page.getByRole('progressbar', { name: 'Paper saturation' })).toHaveAttribute('aria-valuenow', '0')
})

test('rotation before contact uses wheel, arrows, and exact angle without depositing ink', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  await page.mouse.move(b.x + b.width * .7, b.y + b.height * .7)
  const blank = await image(paper), scroll = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 80)
  await expect.poll(() => cursor.getAttribute('data-angle')).not.toBe('0')
  expect(await image(paper)).toBe(blank)
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll)
  await page.getByRole('spinbutton', { name: 'Stamp angle in degrees' }).fill('30')
  await expect(cursor).toHaveAttribute('data-angle', '30')
  await land(page, b)
  const landed = await image(paper)
  await cursor.focus()
  await page.keyboard.press('ArrowRight')
  await expect(cursor).toHaveAttribute('data-angle', '35')
  await page.keyboard.press('ArrowLeft')
  await expect(cursor).toHaveAttribute('data-angle', '30')
  expect(await image(paper)).toBe(landed)
})

test('twisting during contact transfers additional ink and moving on a placed face does not slide', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const p = await land(page, b), before = await image(paper)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.wheel(0, 100)
  await expect.poll(() => cursor.getAttribute('data-angle')).not.toBe('0')
  const angle = await cursor.getAttribute('data-angle')
  await page.mouse.wheel(0, -80)
  await expect.poll(() => cursor.getAttribute('data-angle')).not.toBe(angle)
  await page.mouse.move(p.x - p.size * .25, p.y)
  await expect(cursor).toHaveAttribute('data-sliding', 'false')
  await page.mouse.up()
  expect(await image(paper)).not.toBe(before)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await image(paper)).toBe(before)
  await cursor.focus()
  await page.keyboard.press('Escape')
  await expect(cursor).toHaveAttribute('data-placed', 'false')
})

test('too much contact visibly dampens and spoils the paper; fresh document and undo recover it', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const p = await land(page, b)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await expect(cursor).toHaveAttribute('data-condition', 'damp', { timeout: 6000 })
  await expect(page.getByText('Getting damp — give it a lift', { exact: true })).toBeVisible()
  expect((await stats(page.getByLabel('Paper moisture and ink seepage', { exact: true }))).area).toBeGreaterThan(0)
  await expect(cursor).toHaveAttribute('data-condition', 'soaked', { timeout: 10000 })
  await page.mouse.up()
  await expect(cursor).toHaveAttribute('data-pressed', 'false')
  await expect(page.getByText('Oh dear. This one soaked through.', { exact: true })).toBeVisible()
  const spoiled = await image(paper)
  if (process.env.CAPTURE_PROCESS) await page.screenshot({ path: 'docs/process/06-soaked-document.jpg', fullPage: true })
  await page.mouse.click(p.x + 200, p.y)
  expect(await image(paper)).toBe(spoiled)
  await page.getByRole('button', { name: 'Fresh document', exact: true }).click()
  await expect(cursor).toHaveAttribute('data-condition', 'dry')
  expect((await stats(paper)).area).toBe(0)
  await expect(page.getByRole('progressbar', { name: 'Paper saturation' })).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await image(paper)).toBe(spoiled)
  await expect(cursor).toHaveAttribute('data-condition', 'soaked')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(cursor).toHaveAttribute('data-condition', 'dry')
})

test('export includes the form, ink and moisture, preserves editing, and excludes the stamp carrier', async ({ page }) => {
  const { paper, b } = await studio(page)
  await land(page, b)
  const original = await image(paper)
  await page.getByRole('button', { name: 'Edit stamp', exact: true }).click()
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  expect(await image(paper)).toBe(original)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click()
  const download = await downloadPromise, bytes = await readFile((await download.path())!)
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBe(1200)
  const matches = await page.evaluate(async (dataURL) => {
    const img = new Image(); img.src = dataURL; await img.decode()
    const exported = document.createElement('canvas'), expected = document.createElement('canvas')
    exported.width = expected.width = 1800; exported.height = expected.height = 1200
    exported.getContext('2d')!.drawImage(img, 0, 0)
    const ctx = expected.getContext('2d')!
    for (const label of ['Illustrated request form with a stamp-here area', 'Paper moisture and ink seepage', 'Your stamped composition']) ctx.drawImage(document.querySelector<HTMLCanvasElement>(`canvas[aria-label="${label}"]`)!, 0, 0)
    return exported.toDataURL() === expected.toDataURL()
  }, `data:image/png;base64,${bytes.toString('base64')}`)
  expect(matches).toBe(true)
})

test('desktop and mobile layouts fit, with actual document desk evidence', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const { b } = await studio(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeInViewport()
  await land(page, b)
  expect(errors).toEqual([])
  await page.setViewportSize({ width: 1440, height: 1100 })
  if (process.env.CAPTURE_PROCESS) {
    await page.screenshot({ path: 'docs/process/05-document-desk.jpg', fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: 'Edit stamp', exact: true }).click()
    await page.screenshot({ path: 'docs/process/05-circular-workbench.jpg', fullPage: true, animations: 'disabled' })
  }
})

test('the same slide deposits more ink at a slow speed than a fast speed', async ({ page }, testInfo) => {
  async function stroke(pause: number) {
    await page.goto('./')
    const { paper, b } = await studio(page)
    await page.mouse.move(b.x + b.width * .15, b.y + b.height * .55)
    await page.mouse.down()
    for (let step = 1; step <= 24; step++) {
      await page.mouse.move(b.x + b.width * (.15 + .7 * step / 24), b.y + b.height * .55)
      if (pause) await page.waitForTimeout(pause)
    }
    await page.mouse.up()
    if (process.env.CAPTURE_INK) {
      await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
      await page.screenshot({ path: testInfo.outputPath(pause ? 'slow-slide.png' : 'fast-slide.png'), animations: 'disabled' })
    }
    // Exclude the landing, where both speeds correctly get the same strong patches.
    return paper.evaluate((node: HTMLCanvasElement) => {
      const pixels = node.getContext('2d')!.getImageData(500, 400, 750, 500).data
      let alpha = 0
      for (let i = 3; i < pixels.length; i += 4) alpha += pixels[i]
      return alpha
    })
  }
  const fast = await stroke(0), slow = await stroke(50)
  expect(slow).toBeGreaterThan(fast * 1.35)
})

test('the same turn deposits more ink when rotated slowly, with the same final angle', async ({ page }) => {
  async function spin(pause: number) {
    await page.goto('./')
    // Use an asymmetric mark so turning sweeps new paper, rather than repeatedly
    // saturating the same circular outline used by the other gesture tests.
    const face = await box(page.getByLabel('Shape your personal stamp on the circular rubber face', { exact: true }))
    await page.mouse.move(face.x + face.width * .32, face.y + face.height * .25)
    await page.mouse.down()
    await page.mouse.move(face.x + face.width * .38, face.y + face.height * .73, { steps: 8 })
    await page.mouse.move(face.x + face.width * .73, face.y + face.height * .63, { steps: 8 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Use this stamp' }).click()
    const cursor = page.getByLabel('Stamping surface:', { exact: false })
    const paper = page.getByLabel('Your stamped composition', { exact: true })
    const b = await box(cursor)
    const p = await land(page, b)
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    for (let step = 0; step < 12; step++) {
      await page.mouse.wheel(0, 60)
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      if (pause) await page.waitForTimeout(pause)
    }
    await page.mouse.up()
    return { ink: (await stats(paper)).alpha, angle: Number(await cursor.getAttribute('data-angle')) }
  }
  const fast = await spin(0), slow = await spin(70)
  expect(Math.abs(slow.angle - fast.angle)).toBeLessThanOrEqual(1)
  expect(slow.ink).toBeGreaterThan(fast.ink * 1.15)
})

test('a sliding stamp that stops visibly builds a rich impression before the sheet soaks', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  await page.mouse.move(b.x + b.width * .35, b.y + b.height * .55)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * .6, b.y + b.height * .55)
  await expect(cursor).toHaveAttribute('data-sliding', 'true')
  const early = await stats(paper)
  const endpointInk = () => paper.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext('2d')!.getImageData(920, 500, 320, 320).data
    let alpha = 0
    for (let i = 3; i < data.length; i += 4) alpha += data[i]
    return alpha
  })
  const earlyEndpoint = await endpointInk()
  await expect(page.getByRole('progressbar', { name: 'Paper saturation' })).toHaveAttribute('aria-valuenow', /^(5\d|6\d)$/, { timeout: 6500 })
  const settled = await stats(paper)
  expect(settled.dark).toBeGreaterThan(early.dark * 1.5)
  expect(await endpointInk()).toBeGreaterThan(earlyEndpoint * 1.3)
  await expect(cursor).toHaveAttribute('data-condition', 'soaked', { timeout: 7000 })
  await page.mouse.up()
  await expect(cursor).toHaveAttribute('data-pressed', 'false')
})
