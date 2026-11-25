import { expect, test, type Page, type Locator } from '@playwright/test'

async function pixels(locator: Locator) {
  return locator.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
}
async function openBoard(page: Page, makeStamp = true, capture = false) {
  await page.goto('./')
  if (makeStamp) {
    const pad = page.getByLabel('Shape your personal stamp on the circular rubber face',{exact:true})
    const b = (await pad.boundingBox())!
    await page.mouse.move(b.x+b.width*.3,b.y+b.height*.3); await page.mouse.down()
    await page.mouse.move(b.x+b.width*.7,b.y+b.height*.7,{ steps:10 }); await page.mouse.up()
    await page.mouse.move(b.x+b.width*.7,b.y+b.height*.3); await page.mouse.down()
    await page.mouse.move(b.x+b.width*.3,b.y+b.height*.7,{ steps:10 }); await page.mouse.up()
  }
  if (capture && process.env.CAPTURE_DE3_PROCESS) await page.screenshot({path:'docs/de3/evidence/01-two-destinations.png',fullPage:true,animations:'disabled'})
  await page.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  await expect(page.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  return page.getByLabel('Shared stamping surface',{exact:true})
}
async function land(page: Page, cursor: Locator, x=.5, y=.5) {
  const b = (await cursor.boundingBox())!
  await page.mouse.click(b.x+b.width*x,b.y+b.height*y)
  await expect(page.getByRole('button',{name:'Leave my mark',exact:true})).toBeEnabled()
}
async function share(page: Page) {
  await page.getByRole('button',{name:/^(Leave my mark|Retry sharing)$/}).click()
  await expect(page.getByText('Your mark is part of the board. Future visitors will find it here.',{exact:true})).toBeVisible()
}

test('public viewing needs no stamp; two independent visitors append concurrently and survive refresh', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext()
  const first = await a.newPage(), second = await b.newPage()
  const one = await openBoard(first,true,true), two = await openBoard(second)
  const before = await first.request.get('http://127.0.0.1:8788/contributions').then(r=>r.json())
  await land(first,one,.35,.4); await land(second,two,.65,.6)
  await Promise.all([share(first),share(second)])
  await first.getByRole('button',{name:'Refresh board',exact:true}).click()
  await expect(first.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  const expected = await pixels(first.getByTestId('shared-artwork'))
  if (process.env.CAPTURE_DE3_PROCESS) await first.screenshot({path:'docs/de3/evidence/02-independent-contributions.png',fullPage:true,animations:'disabled'})
  const after = await first.request.get('http://127.0.0.1:8788/contributions').then(r=>r.json())
  expect(after.total).toBe(before.total+2)
  expect(new Set(after.contributions.map((r:{sequence:number})=>r.sequence)).size).toBe(after.total)
  await first.reload()
  await first.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  await expect(first.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  await expect.poll(()=>pixels(first.getByTestId('shared-artwork'))).toBe(expected)
  await expect(first.getByRole('button',{name:'Make a stamp',exact:true})).toBeVisible()
  await expect(first.getByRole('button',{name:'Leave my mark',exact:true})).toBeDisabled()
  const c = await browser.newContext(), viewer = await c.newPage()
  await openBoard(viewer,false)
  await expect.poll(()=>pixels(viewer.getByTestId('shared-artwork'))).toBe(expected)
  expect(await viewer.evaluate(()=>localStorage.getItem('stamp-local-session'))).toBeNull()
  expect(await viewer.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sb-')))).toEqual([])
  await a.close(); await b.close(); await c.close()
})

test('a local draft recovers after refresh; undo and discard never remove community marks', async ({ page }) => {
  const cursor = await openBoard(page)
  const community = await pixels(page.getByTestId('shared-artwork'))
  await land(page,cursor,.4,.5)
  const draft = await pixels(page.getByTestId('shared-draft'))
  await page.reload()
  await page.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  await expect(page.getByText('Your unfinished draft is back. It has not been shared.',{exact:true})).toBeVisible()
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(draft)
  await expect(page.getByRole('button',{name:'Leave my mark',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Discard',exact:true}).click()
  await expect(page.getByRole('button',{name:'Leave my mark',exact:true})).toBeDisabled()
  await expect.poll(()=>pixels(page.getByTestId('shared-artwork'))).toBe(community)
})

test('an uncertain response preserves the draft, survives refresh, and retries without a duplicate', async ({ page }) => {
  const cursor = await openBoard(page)
  await land(page,cursor)
  const original = await pixels(page.getByTestId('shared-draft'))
  let id = ''
  await page.route('**/contributions',async route => {
    if (route.request().method() !== 'POST') return route.continue()
    id = route.request().postDataJSON().id
    await route.fetch() // the server saved it, but the browser loses the response
    await route.abort('connectionfailed')
  })
  // Prevent auto-refresh from confirming it before we inspect the failure state.
  await page.route('**/contributions?after=*',route=>route.abort('connectionfailed'))
  await page.getByRole('button',{name:'Leave my mark',exact:true}).click()
  await expect(page.getByRole('button',{name:'Retry sharing',exact:true})).toBeEnabled()
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(original)
  if (process.env.CAPTURE_DE3_PROCESS) await page.screenshot({path:'docs/de3/evidence/03-recoverable-share.png',fullPage:true,animations:'disabled'})
  const totalBefore = await page.request.get('http://127.0.0.1:8788/contributions').then(r=>r.json())
  await page.unroute('**/contributions')
  await page.getByRole('button',{name:'Retry sharing',exact:true}).click()
  await expect(page.getByRole('button',{name:'Retry sharing',exact:true})).toBeEnabled()
  const totalAfter = await page.request.get('http://127.0.0.1:8788/contributions').then(r=>r.json())
  expect(totalAfter.total).toBe(totalBefore.total)
  expect(totalAfter.contributions.filter((r:{id:string})=>r.id===id)).toHaveLength(1)
  await page.reload()
  await page.unroute('**/contributions?after=*')
  await page.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  await expect(page.getByText('Your mark is part of the board. Future visitors will find it here.',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Leave my mark',exact:true})).toBeDisabled()
})

test('shared stamp keeps pressure, sliding, rotation and ink choices; personal document stays private', async ({ page }) => {
  const cursor = await openBoard(page)
  await page.getByRole('button',{name:'Indigo',exact:true}).click()
  await page.getByLabel('Shared stamp angle',{exact:true}).fill('45')
  await expect(cursor).toHaveAttribute('data-angle','45')
  await land(page,cursor,.3,.5)
  const draft = page.getByTestId('shared-draft'), first = await pixels(draft)
  const b = (await cursor.boundingBox())!
  await page.mouse.move(b.x+b.width*.31,b.y+b.height*.5); await page.mouse.down()
  await page.waitForTimeout(250); await page.mouse.up()
  expect(await pixels(draft)).not.toBe(first)
  await expect(page.getByRole('button',{name:'Forest',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Lift stamp',exact:false}).click()
  await page.mouse.move(b.x+b.width*.55,b.y+b.height*.6); await page.mouse.down()
  await page.mouse.move(b.x+b.width*.8,b.y+b.height*.6,{steps:12})
  await expect(cursor).toHaveAttribute('data-sliding','true')
  await page.mouse.up()
  const slid = await pixels(draft)
  await page.getByRole('button',{name:'Undo',exact:true}).click()
  await expect.poll(()=>pixels(draft)).not.toBe(slid)
  const saved = await pixels(draft)
  await page.getByRole('button',{name:'Go to Personal Studio',exact:true}).click()
  const privateCursor = page.getByLabel('Stamping surface:',{exact:false})
  const p = (await privateCursor.boundingBox())!
  await page.mouse.click(p.x+p.width*.5,p.y+p.height*.6)
  const privateImage = await pixels(page.getByLabel('Your stamped composition',{exact:true}))
  await page.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  expect(await pixels(draft)).toBe(saved)
  await page.getByRole('button',{name:'Go to Personal Studio',exact:true}).click()
  expect(await pixels(page.getByLabel('Your stamped composition',{exact:true}))).toBe(privateImage)
  await page.getByRole('navigation').getByRole('button',{name:'Global Stamp Board',exact:true}).click()
  await share(page)
  for (const color of ['Forest','Ochre']) {
    await page.getByRole('button',{name:color,exact:true}).click()
    await land(page,cursor,color==='Forest'?.2:.8,.75)
    await share(page)
  }
})

test('zoom and move board change the view without adding ink, including a narrow screen', async ({ page }) => {
  const cursor = await openBoard(page)
  const original = await pixels(page.getByTestId('shared-draft'))
  await page.getByRole('button',{name:'Zoom in',exact:true}).click()
  await page.getByRole('button',{name:'Move board',exact:true}).click()
  const b = (await cursor.boundingBox())!
  await page.mouse.move(b.x+100,b.y+100); await page.mouse.down()
  await page.mouse.move(b.x+25,b.y+25,{steps:5}); await page.mouse.up()
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(original)
  await page.getByRole('button',{name:'Fit',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByRole('button',{name:'Leave my mark',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
