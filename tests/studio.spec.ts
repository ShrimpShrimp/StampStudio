import { expect, test, type Page, type Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function box(locator: Locator) {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Canvas is not visible')
  return bounds
}
async function design(page: Page) {
  const canvas = page.getByLabel('Draw your personal stamp here', { exact: true })
  const b = await box(canvas)
  // An asymmetric, hollow symbol, drawn using real pointer input.
  await page.mouse.move(b.x + b.width * .24, b.y + b.height * .28)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * .72, b.y + b.height * .38, { steps: 10 })
  await page.mouse.move(b.x + b.width * .4, b.y + b.height * .75, { steps: 10 })
  await page.mouse.move(b.x + b.width * .24, b.y + b.height * .28, { steps: 10 })
  await page.mouse.up()
  return canvas
}
async function image(locator: Locator) {
  return locator.evaluate((node: HTMLCanvasElement) => node.toDataURL())
}
async function pixels(locator: Locator) {
  return locator.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
    let alpha = 0, area = 0, max = 0
    for (let i = 3; i < data.length; i += 4) {
      alpha += data[i]
      if (data[i]) area++
      max = Math.max(max, data[i])
    }
    return { alpha, area, max }
  })
}
async function studio(page: Page) {
  await design(page)
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  const cursor = page.getByLabel('Stamping surface:', { exact: false })
  const paper = page.getByLabel('Your stamped composition', { exact: true })
  return { cursor, paper, b: await box(cursor) }
}

test.beforeEach(async ({ page }) => { await page.goto('./') })

test('freehand design, eraser, undo, clear, and faithful transparent original', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Use this stamp' })).toBeDisabled()
  const canvas = await design(page)
  const original = await image(canvas)
  const originalPixels = await pixels(canvas)
  expect(originalPixels.area).toBeGreaterThan(5000)
  const b = await box(canvas)
  await page.getByRole('button', { name: 'Erase', exact: true }).click()
  await page.mouse.move(b.x + b.width * .42, b.y + b.height * .27)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * .42, b.y + b.height * .45, { steps: 8 })
  await page.mouse.up()
  expect((await pixels(canvas)).area).toBeLessThan(originalPixels.area)
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click()
  expect(await image(canvas)).toBe(original)
  await page.getByRole('button', { name: 'Clear drawing', exact: true }).click()
  expect((await pixels(canvas)).area).toBe(0)
  await expect(page.getByRole('button', { name: 'Use this stamp' })).toBeDisabled()
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click()
  expect(await image(canvas)).toBe(original)
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  await page.getByRole('button', { name: 'Edit stamp', exact: true }).click()
  expect(await image(canvas)).toBe(original)
})

test('tap is faint; a stationary hold darkens while pressed and stops on release', async ({ page }) => {
  const { paper, b } = await studio(page)
  const x = b.x + b.width * .35, y = b.y + b.height * .4
  await page.mouse.click(x, y)
  const tap = await pixels(paper)
  expect(tap.max).toBeGreaterThan(20)
  expect(tap.max).toBeLessThan(100)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(300)
  const early = await pixels(paper)
  await page.waitForTimeout(1100)
  const later = await pixels(paper)
  expect(later.alpha).toBeGreaterThan(early.alpha * 1.4)
  expect(later.alpha).toBeGreaterThan(tap.alpha * 2)
  await page.mouse.up()
  const released = await image(paper)
  await page.waitForTimeout(250)
  expect(await image(paper)).toBe(released)
})

test('fast drag stays continuous, undo removes the whole gesture, clear is undoable', async ({ page }) => {
  const { paper, b } = await studio(page)
  await page.mouse.move(b.x + b.width * .15, b.y + b.height * .5)
  await page.mouse.down()
  // A single long event exercises interpolation, not just dense browser events.
  await page.mouse.move(b.x + b.width * .85, b.y + b.height * .5)
  await page.mouse.up()
  const hasGaps = await paper.evaluate((node: HTMLCanvasElement) => {
    const ctx = node.getContext('2d')!
    for (let x = Math.round(node.width * .18); x < node.width * .82; x += 20) {
      const data = ctx.getImageData(x, 0, 1, node.height).data
      if (!data.some((value, i) => i % 4 === 3 && value > 0)) return true
    }
    return false
  })
  expect(hasGaps).toBe(false)
  await expect(page.getByText('1 gesture. Entirely yours.')).toBeVisible()
  const trail = await image(paper)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await image(paper)).toBe(trail)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
})

test('wheel and keyboard twist deposit overlapping orientations, combined gestures undo together', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const x = b.x + b.width * .4, y = b.y + b.height * .4
  await page.mouse.move(x, y)
  await page.mouse.down()
  const before = await pixels(paper)
  const scrollY = await page.evaluate(() => window.scrollY)
  const cursorBefore = await image(cursor)
  await page.mouse.wheel(0, 100)
  await expect.poll(() => image(cursor)).not.toBe(cursorBefore)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
  const clockwise = await image(cursor)
  await page.mouse.wheel(0, -80)
  await expect.poll(() => image(cursor)).not.toBe(clockwise)
  expect((await pixels(paper)).area).toBeGreaterThan(before.area * 1.4)
  const beforeKeys = await image(cursor)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(350)
  await page.keyboard.up('ArrowRight')
  expect(await image(cursor)).not.toBe(beforeKeys)
  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(250)
  await page.keyboard.up('ArrowLeft')
  await page.mouse.move(x + 200, y + 100, { steps: 12 })
  await page.mouse.wheel(0, 100)
  await page.mouse.move(x + 300, y + 20, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByText('1 gesture. Entirely yours.')).toBeVisible()
  await expect(cursor).toHaveAttribute('data-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
  if (process.env.CAPTURE_PROCESS) {
    await page.screenshot({ path: 'docs/process/03-combined-gestures.jpg', fullPage: true })
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
  // With contact released, ordinary page scrolling resumes on the paper.
  await page.mouse.wheel(0, 180)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY)
})

test('paper survives editing, export is opaque 1800×1200 PNG, pointer leaving is safe', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  await page.mouse.click(b.x + b.width * .4, b.y + b.height * .4)
  const originalPaper = await image(paper)
  await page.getByRole('button', { name: 'Edit stamp', exact: true }).click()
  await page.getByRole('button', { name: 'Use this stamp' }).click()
  expect(await image(paper)).toBe(originalPaper)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('make-your-mark.png')
  const path = await download.path()
  const bytes = await readFile(path!)
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(1800)
  expect(bytes.readUInt32BE(20)).toBe(1200)
  const corner = await page.evaluate(async (dataURL) => {
    const img = new Image()
    img.src = dataURL
    await img.decode()
    const output = document.createElement('canvas')
    output.width = img.width; output.height = img.height
    const ctx = output.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return [...ctx.getImageData(0, 0, 1, 1).data]
  }, `data:image/png;base64,${bytes.toString('base64')}`)
  expect(corner).toEqual([255, 253, 247, 255])
  await page.mouse.move(b.x + 15, b.y + 40)
  await page.mouse.down()
  await page.mouse.move(b.x - 30, b.y + 40)
  await page.mouse.up()
  await expect(cursor).toHaveAttribute('data-pressed', 'false')
})

test('desktop and narrow layouts have no horizontal overflow or inaccessible controls', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await studio(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Edit stamp', exact: true })).toBeInViewport()
  expect(errors).toEqual([])
})
