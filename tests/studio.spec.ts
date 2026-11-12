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
async function studio(page: Page, frame = false) {
  if (frame) {
    const b = await box(page.getByLabel('Draw your personal stamp here', { exact: true }))
    await page.mouse.move(b.x + b.width * .15, b.y + b.height * .15)
    await page.mouse.down()
    for (const [x, y] of [[.85, .15], [.85, .85], [.15, .85], [.15, .15]]) {
      await page.mouse.move(b.x + b.width * x, b.y + b.height * y, { steps: 8 })
    }
    await page.mouse.up()
  } else await design(page)
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

async function place(page: Page, b: { x: number; y: number; width: number; height: number }, fx = .5, fy = .45) {
  const x = b.x + b.width * fx, y = b.y + b.height * fy
  await page.mouse.click(x, y)
  return { x, y, size: 300 * b.width / 1800 }
}

async function sideInk(paper: Locator, side: 'left' | 'right') {
  return paper.evaluate((node: HTMLCanvasElement, side) => {
    const ctx = node.getContext('2d')!
    // Default center: (900, 540), 300px stamp, frame sides at ±105px.
    const x = side === 'left' ? 780 : 990
    const data = ctx.getImageData(x, 505, 30, 70).data
    let sum = 0
    for (let i = 3; i < data.length; i += 4) sum += data[i]
    return sum
  }, side)
}

test('first press places a fixed stamp and never transfers ink, even if held or dragged', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const x = b.x + b.width * .5, y = b.y + b.height * .45
  await page.mouse.move(x, y)
  await page.mouse.down()
  await expect(cursor).toHaveAttribute('data-placed', 'true')
  const placedImage = await image(cursor)
  await page.waitForTimeout(350)
  await page.mouse.move(x + 180, y + 80)
  await page.mouse.up()
  expect((await pixels(paper)).area).toBe(0)
  expect(await image(cursor)).toBe(placedImage)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await expect(page.getByText('Now press the stamp.', { exact: true })).toBeVisible()
  await expect(page.getByRole('slider', { name: /Stamp size/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
  await expect(cursor).toHaveAttribute('data-placed', 'false')
  await expect(page.getByRole('slider', { name: /Stamp size/ })).toBeEnabled()
})

test('edge pressure grows locally while held; pressing the opposite edge fills only that edge', async ({ page }) => {
  const { paper, b } = await studio(page, true)
  const p = await place(page, b)
  await page.mouse.move(p.x - p.size * .35, p.y)
  await page.mouse.down()
  await page.waitForTimeout(250)
  const early = await sideInk(paper, 'left')
  await page.waitForTimeout(1000)
  const left = await sideInk(paper, 'left')
  expect(left).toBeGreaterThan(early * 1.4)
  expect(await sideInk(paper, 'right')).toBe(0)
  await page.mouse.up()
  const leftAfterRelease = await sideInk(paper, 'left')
  const released = await image(paper)
  await page.waitForTimeout(200)
  expect(await image(paper)).toBe(released)
  await page.mouse.move(p.x + p.size * .35, p.y)
  await page.mouse.down()
  await page.waitForTimeout(800)
  await page.mouse.up()
  expect(await sideInk(paper, 'right')).toBeGreaterThan(1000)
  expect(await sideInk(paper, 'left')).toBe(leftAfterRelease)
  const colorDrift = await paper.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 100 && [165, 45, 43].some((channel, c) => Math.abs(data[i + c] - channel) > 3)) return true
    }
    return false
  })
  expect(colorDrift).toBe(false)
  await expect(page.getByLabel('Stamping surface:', { exact: false })).toHaveAttribute('data-placed', 'true')
})

test('moving pressure stays in one footprint; lift, undo, and clear retain the paper correctly', async ({ page }) => {
  const { paper, cursor, b } = await studio(page, true)
  const p = await place(page, b)
  await page.mouse.move(p.x - p.size * .35, p.y)
  await page.mouse.down()
  await page.waitForTimeout(200)
  await page.mouse.move(p.x + p.size * .35, p.y, { steps: 12 })
  await page.waitForTimeout(200)
  await page.mouse.move(p.x + p.size * 2, p.y)
  const beforeOutside = await image(paper)
  await page.waitForTimeout(200)
  expect(await image(paper)).toBe(beforeOutside)
  await page.mouse.up()
  const outsideArea = await paper.evaluate((node: HTMLCanvasElement) => {
    const data = node.getContext('2d')!.getImageData(1080, 0, 700, node.height).data
    return data.some((v, i) => i % 4 === 3 && v > 0)
  })
  expect(outsideArea).toBe(false)
  await expect(cursor).toHaveAttribute('data-placed', 'true')
  await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
  await expect(page.getByText('1 pressure pass. Entirely yours.')).toBeVisible()
  const worked = await image(paper)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await image(paper)).toBe(worked)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
})

test('twisting transfers overlapping local ink; scrolling is captured only during pressure', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const p = await place(page, b)
  await page.mouse.move(p.x, p.y)
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
  expect((await pixels(paper)).area).toBeGreaterThan(before.area * 1.1)
  const beforeKeys = await image(cursor)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(350)
  await page.keyboard.up('ArrowRight')
  expect(await image(cursor)).not.toBe(beforeKeys)
  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(250)
  await page.keyboard.up('ArrowLeft')
  await page.mouse.up()
  await expect(cursor).toHaveAttribute('data-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await pixels(paper)).area).toBe(0)
  await page.mouse.wheel(0, 180)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY)
})

test('paper survives editing, export is opaque 1800×1200 PNG, pointer leaving is safe', async ({ page }) => {
  const { paper, cursor, b } = await studio(page)
  const placed = await place(page, b)
  await page.mouse.click(placed.x, placed.y)
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
  await place(page, b)
  await page.mouse.move(placed.x, placed.y)
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

test('capture the revision: an incomplete contact and an impression worked around its edges', async ({ page }) => {
  const { b } = await studio(page, true)
  const partial = await place(page, b, .32, .5)
  await page.mouse.move(partial.x - partial.size * .35, partial.y)
  await page.mouse.down()
  await page.waitForTimeout(450)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
  const complete = await place(page, b, .68, .5)
  for (const [dx, dy] of [[-.35, -.35], [0, -.35], [.35, -.35], [.35, 0], [.35, .35], [0, .35], [-.35, .35], [-.35, 0]]) {
    await page.mouse.move(complete.x + complete.size * dx, complete.y + complete.size * dy)
    await page.mouse.down()
    await page.waitForTimeout(220)
    await page.mouse.up()
  }
  await page.getByRole('button', { name: 'Lift stamp', exact: false }).click()
  await expect(page.getByText('9 pressure passes. Entirely yours.')).toBeVisible()
  if (process.env.CAPTURE_PROCESS) {
    await page.screenshot({ path: 'docs/process/04-place-and-pressure.jpg', fullPage: true })
  }
})
