import { expect, test, type Page, type Locator } from '@playwright/test'
import { loadEnv } from 'vite'
import { writeFile } from 'node:fs/promises'

const env = loadEnv('development', process.cwd(), 'VITE_')
const origin = env.VITE_SUPABASE_URL, api = `${origin}/functions/v1/stamp-board`
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
const image = (canvas: Locator) => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())
const boardButton = (page: Page) => page.getByRole('navigation').getByRole('button',{name:'Shared board',exact:true})

async function prepare(page: Page, ink: string, x: number, y: number) {
  await page.goto('./')
  const pad = page.getByLabel('Shape your personal stamp on the circular rubber face',{exact:true})
  const b = (await pad.boundingBox())!
  // A recognizable T identifies these as documented technical checks, not participant work.
  await page.mouse.move(b.x+b.width*.3,b.y+b.height*.28); await page.mouse.down()
  await page.mouse.move(b.x+b.width*.7,b.y+b.height*.28,{steps:10}); await page.mouse.up()
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.28); await page.mouse.down()
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.72,{steps:10}); await page.mouse.up()
  await boardButton(page).click()
  await expect(page.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:ink,exact:true}).click()
  const cursor=page.getByLabel('Shared stamping surface',{exact:true}), c=(await cursor.boundingBox())!
  await page.mouse.click(c.x+c.width*x,c.y+c.height*y)
  await expect(page.getByRole('button',{name:'Share to board',exact:true})).toBeEnabled()
}

test('hosted board persists across isolated visitors, concurrent writes and a lost response',async({browser,request})=>{
  test.skip(process.env.ALLOW_HOSTED_WRITES !== '1','Opt in explicitly: this adds two permanent technical test marks to the configured board.')
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()])
  const [a,b,viewer]=await Promise.all(contexts.map(c=>c.newPage()))
  const records: {id:string;ink:string;note:string}[]=[]
  const checks: string[]=[]
  const report: Record<string,unknown>={kind:'technical verification; no participants',date:new Date().toISOString(),project:origin,contributions:records,checks,status:'in progress'}
  const list=async()=>{
    const response=await request.get(`${api}/contributions?after=0`,{headers:{apikey:key}})
    expect(response.status()).toBe(200)
    return response.json()
  }
  try {
    const before=await list(); report.totalBefore=before.total
    await prepare(a,'Indigo',.3,.45); await prepare(b,'Ochre',.65,.6)
    const original=await image(a.getByTestId('shared-draft'))
    await a.route(`${api}/contributions`,async route=>{
      const payload=route.request().postDataJSON()
      records.push({id:payload.id,ink:'Indigo',note:'Technical T; deliberately lost response after acceptance.'})
      const response=await route.fetch(); expect(response.status()).toBe(200)
      await route.abort('connectionfailed')
    })
    const blockRefresh=/\/functions\/v1\/stamp-board\/contributions\?after=/
    await a.route(blockRefresh,route=>route.abort('connectionfailed'))
    b.on('request',r=>{if(r.url()===`${api}/contributions`&&r.method()==='POST')records.push({id:r.postDataJSON().id,ink:'Ochre',note:'Technical T; second independent visitor.'})})
    await Promise.all([
      a.getByRole('button',{name:'Share to board',exact:true}).click().then(()=>expect(a.getByRole('button',{name:'Retry sharing',exact:true})).toBeEnabled()),
      b.getByRole('button',{name:'Share to board',exact:true}).click().then(()=>expect(b.getByText('Shared. Your mark stays here.',{exact:true})).toBeVisible())
    ])
    expect(await image(a.getByTestId('shared-draft'))).toBe(original)
    const after=await list()
    expect(after.total).toBe(before.total+2)
    for(const row of records) expect(after.contributions.filter((r:{id:string})=>r.id===row.id)).toHaveLength(1)
    checks.push('Concurrent contributions from independent anonymous sessions both persisted.','An accepted submission with a lost response kept its exact local draft.')
    await a.unroute(`${api}/contributions`)
    let retryID=''
    a.on('request',r=>{if(r.url()===`${api}/contributions`&&r.method()==='POST')retryID=r.postDataJSON().id})
    const retryResponse=a.waitForResponse(r=>r.url()===`${api}/contributions`&&r.request().method()==='POST')
    await a.getByRole('button',{name:'Retry sharing',exact:true}).click()
    expect((await retryResponse).status()).toBe(200)
    expect(retryID).toBe(records.find(r=>r.ink==='Indigo')!.id)
    expect((await list()).total).toBe(after.total)
    checks.push('Retry reused the same contribution ID and added no duplicate.')
    await a.reload(); await a.unroute(blockRefresh); await boardButton(a).click()
    await expect(a.getByText('Shared. Your mark stays here.',{exact:true})).toBeVisible()
    await expect(a.getByRole('button',{name:'Share to board',exact:true})).toBeHidden()
    checks.push('Refresh recovered the pending draft and cleared it only after finding the committed layer.')
    await b.getByRole('button',{name:'Refresh board',exact:true}).click()
    await expect(b.getByRole('button',{name:'Refresh board',exact:true})).toBeEnabled()
    const expected=await image(a.getByTestId('shared-artwork'))
    await expect.poll(()=>image(b.getByTestId('shared-artwork'))).toBe(expected)
    await viewer.goto('./'); await boardButton(viewer).click()
    await expect.poll(()=>image(viewer.getByTestId('shared-artwork'))).toBe(expected)
    expect(await viewer.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')))).toEqual([])
    checks.push('A fresh visitor with no Auth session saw identical committed pixels.','Two separate browser storage contexts composed the same artwork.')
    const direct=await request.get(`${origin}/rest/v1/stamp_contributions?select=id&limit=1`,{headers:{apikey:key}})
    expect([401,403]).toContain(direct.status())
    const authenticated=await b.evaluate(async({origin,key})=>{
      const storage=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'))!
      const session=JSON.parse(localStorage.getItem(storage)!)
      return (await fetch(`${origin}/rest/v1/stamp_contributions?select=id&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${session.access_token}`}})).status
    },{origin,key})
    expect(authenticated).toBe(403)
    expect((await request.post(`${api}/contributions`,{headers:{apikey:key},data:{}})).status()).toBe(401)
    expect((await request.delete(`${api}/contributions`,{headers:{apikey:key}})).status()).toBe(404)
    checks.push('Anonymous and authenticated clients could not read the backing table directly.','Unauthenticated submissions were rejected; no delete route exists.')
    report.totalAfter=(await list()).total; report.status='passed'
    await viewer.screenshot({path:'docs/de3/evidence/04-hosted-cross-session.png',fullPage:true,animations:'disabled'})
  } finally {
    await writeFile('docs/de3/hosted-verification.json',JSON.stringify(report,null,2)+'\n')
    await Promise.all(contexts.map(c=>c.close()))
  }
})
