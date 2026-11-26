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
  await page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  await expect(page.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  return page.getByLabel('Shared stamping surface',{exact:true})
}
async function land(page: Page, cursor: Locator, x=.5, y=.5) {
  const b = (await cursor.boundingBox())!
  await page.mouse.click(b.x+b.width*x,b.y+b.height*y)
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeEnabled()
}
async function share(page: Page) {
  await page.getByRole('button',{name:/^(Share to board|Retry sharing)$/}).click()
  await expect(page.getByText('Shared. Your mark stays here.',{exact:true})).toBeVisible()
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
  await first.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  await expect(first.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  await expect.poll(()=>pixels(first.getByTestId('shared-artwork'))).toBe(expected)
  await expect(first.getByRole('button',{name:'Make a stamp',exact:true})).toBeVisible()
  await expect(first.getByRole('button',{name:'Share to board',exact:true})).toBeHidden()
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
  await page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  await expect(page.getByText('Draft restored. Not shared yet.',{exact:true})).toBeVisible()
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(draft)
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Discard',exact:true}).click()
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeHidden()
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
  await page.getByRole('button',{name:'Share to board',exact:true}).click()
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
  await page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  await expect(page.getByText('Shared. Your mark stays here.',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeHidden()
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
  await page.getByRole('navigation').getByRole('button',{name:'Personal studio',exact:true}).click()
  const privateCursor = page.getByLabel('Stamping surface:',{exact:false})
  const p = (await privateCursor.boundingBox())!
  await page.mouse.click(p.x+p.width*.5,p.y+p.height*.6)
  const privateImage = await pixels(page.getByLabel('Your stamped composition',{exact:true}))
  await page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  expect(await pixels(draft)).toBe(saved)
  await page.getByRole('navigation').getByRole('button',{name:'Personal studio',exact:true}).click()
  expect(await pixels(page.getByLabel('Your stamped composition',{exact:true}))).toBe(privateImage)
  await page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true}).click()
  await share(page)
  for (const color of ['Forest','Ochre']) {
    await page.getByRole('button',{name:color,exact:true}).click()
    await land(page,cursor,color==='Forest'?.2:.8,.75)
    await share(page)
  }
})

test('Move drags fitted paper in both directions without adding ink, and Fit recentres it', async ({ page }) => {
  await page.setViewportSize({width:1900,height:1000})
  const cursor = await openBoard(page)
  const original = await pixels(page.getByTestId('shared-draft'))
  const community = await pixels(page.getByTestId('shared-artwork'))
  const initial = (await cursor.boundingBox())!
  await page.getByRole('button',{name:'Move',exact:true}).click()
  async function drag(dx:number,dy:number) {
    const b=(await cursor.boundingBox())!
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down()
    await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:8}); await page.mouse.up()
  }
  await drag(120,70)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(120)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-initial.y)).toBe(70)
  await drag(-180,-110)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(-60)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-initial.y)).toBe(-40)
  const contact=(await cursor.boundingBox())!
  await page.mouse.move(contact.x+contact.width/2,contact.y+contact.height/2); await page.mouse.down()
  await page.mouse.move(contact.x+contact.width/2+20,contact.y+contact.height/2+10)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-contact.x)).toBe(20)
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
  const interrupted=(await cursor.boundingBox())!
  await page.mouse.move(contact.x+contact.width/2+100,contact.y+contact.height/2+90); await page.mouse.up()
  expect((await cursor.boundingBox())!.x).toBeCloseTo(interrupted.x,1)
  expect((await cursor.boundingBox())!.y).toBeCloseTo(interrupted.y,1)
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(original)
  expect(await pixels(page.getByTestId('shared-artwork'))).toBe(community)
  await page.getByRole('button',{name:'Fit',exact:true}).click()
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(0)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-initial.y)).toBe(0)
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByRole('button',{name:'Move',exact:true})).toBeInViewport()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('zoom keeps the viewed location, wheel and keys pan, and stamping follows the moved paper', async ({ page }) => {
  const cursor=await openBoard(page), view=page.getByRole('region',{name:'Shared board view',exact:true})
  const initial=(await cursor.boundingBox())!
  await page.getByRole('button',{name:'Move',exact:true}).click()
  await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2); await page.mouse.down()
  await page.mouse.move(initial.x+initial.width/2+90,initial.y+initial.height/2+50,{steps:6}); await page.mouse.up()
  async function centre() {
    const paper=(await cursor.boundingBox())!, frame=(await view.boundingBox())!
    return {x:(frame.x+frame.width/2-paper.x)/paper.width,y:(frame.y+frame.height/2-paper.y)/paper.height}
  }
  const before=await centre()
  await page.getByRole('button',{name:'Zoom in',exact:true}).click()
  await page.getByRole('button',{name:'Zoom in',exact:true}).click()
  const after=await centre()
  expect(after.x).toBeCloseTo(before.x,3); expect(after.y).toBeCloseTo(before.y,3)
  const enlarged=(await cursor.boundingBox())!
  expect(enlarged.width/initial.width).toBeCloseTo(2,2)
  const frame=(await view.boundingBox())!
  await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2)
  await page.mouse.wheel(60,30)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-enlarged.x)).toBe(-60)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-enlarged.y)).toBe(-30)
  await view.press('ArrowRight')
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-enlarged.x)).toBe(-100)
  await view.press('Escape')
  await expect(page.getByRole('button',{name:'Move',exact:true})).toHaveAttribute('aria-pressed','false')
  const moved=(await cursor.boundingBox())!
  await page.mouse.click(moved.x+moved.width/2,moved.y+moved.height/2)
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeEnabled()
  const bounds=await page.getByTestId('shared-draft').evaluate((canvas:HTMLCanvasElement)=>{
    const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data
    let left=canvas.width,right=0,top=canvas.height,bottom=0,area=0
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);area++
    }
    return {left,right,top,bottom,area}
  })
  expect(bounds.area).toBeGreaterThan(50)
  expect(bounds.left).toBeGreaterThan(1040);expect(bounds.right).toBeLessThan(1360)
  expect(bounds.top).toBeGreaterThan(640);expect(bounds.bottom).toBeLessThan(960)
  const ink=await pixels(page.getByTestId('shared-draft'))
  await page.getByLabel('Shared stamp angle',{exact:true}).fill('35')
  await expect(cursor).toHaveAttribute('data-angle','35')
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(ink)
  await page.getByRole('button',{name:'Fit',exact:true}).click()
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.width-initial.width)).toBe(0)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(0)
  await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-initial.y)).toBe(0)
})

test('touch panning works at Fit and recovers from an interrupted touch',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  try {
    const cursor=await openBoard(page), view=page.getByRole('region',{name:'Shared board view',exact:true})
    await page.getByRole('button',{name:'Move',exact:true}).click()
    await view.scrollIntoViewIfNeeded()
    const original=await pixels(page.getByTestId('shared-draft')), initial=(await cursor.boundingBox())!
    const touch=await context.newCDPSession(page)
    async function drag(dx:number,dy:number,cancel=false){
      const b=(await cursor.boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]})
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:1}]})
      await touch.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]})
    }
    await drag(45,35,true)
    await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(45)
    await drag(-25,-20)
    await expect.poll(async()=>Math.round((await cursor.boundingBox())!.x-initial.x)).toBe(20)
    await expect.poll(async()=>Math.round((await cursor.boundingBox())!.y-initial.y)).toBe(15)
    expect(await pixels(page.getByTestId('shared-draft'))).toBe(original)
    expect(await view.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))).toEqual({x:0,y:0})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  } finally {await context.close()}
})


test('browsing starts in Move; making a stamp reveals tools and keeps new marks private', async ({ page }) => {
  const cursor = await openBoard(page, false)
  const move = page.getByRole('button', { name: 'Move', exact: true })
  const stampMode = page.getByRole('button', { name: 'Stamp', exact: true })
  await expect(move).toHaveAttribute('aria-pressed', 'true')
  await expect(stampMode).toBeDisabled()
  await expect(page.getByLabel('Shared stamp size', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Share to board', exact: true })).toBeHidden()
  const view = page.getByRole('region', { name: 'Shared board view', exact: true })
  const initial = (await cursor.boundingBox())!
  await view.press('ArrowRight')
  await expect.poll(async () => Math.round((await cursor.boundingBox())!.x - initial.x)).toBe(-40)
  await view.press('Escape')
  await expect(move).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Make a stamp', exact: true }).click()
  const pad = (await page.getByLabel('Shape your personal stamp on the circular rubber face', { exact: true }).boundingBox())!
  await page.mouse.move(pad.x + pad.width * .3, pad.y + pad.height * .3)
  await page.mouse.down()
  await page.mouse.move(pad.x + pad.width * .7, pad.y + pad.height * .7, { steps: 10 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Stamp on shared board', exact: true }).click()
  await expect(stampMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Shared stamp size', { exact: true })).toBeVisible()
  const before = await page.request.get('http://127.0.0.1:8788/contributions').then(r => r.json())
  await land(page, cursor)
  await expect(page.getByText('Not shared yet.', { exact: true })).toBeVisible()
  await expect(page.getByText('Press around the edges, then lift.', { exact: true })).toBeVisible()
  const ink = await pixels(page.getByTestId('shared-draft'))
  await move.click()
  await expect(page.getByText('Drag to move.', { exact: true })).toBeVisible()
  await stampMode.click()
  await expect(stampMode).toHaveAttribute('aria-pressed', 'true')
  expect(await pixels(page.getByTestId('shared-draft'))).toBe(ink)
  const after = await page.request.get('http://127.0.0.1:8788/contributions').then(r => r.json())
  expect(after.total).toBe(before.total)
})
