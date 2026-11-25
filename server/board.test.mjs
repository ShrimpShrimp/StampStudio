import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { createBoardServer } from './board.mjs'

function png(width=2, height=2, color='#a52d2b') {
  function chunk(name, data) {
    const type = Buffer.from(name), body = Buffer.concat([type,data])
    let checksum = -1
    for (const byte of body) {
      checksum ^= byte
      for (let bit=0;bit<8;bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0)
    }
    const length = Buffer.alloc(4), crc = Buffer.alloc(4)
    length.writeUInt32BE(data.length); crc.writeUInt32BE((checksum ^ -1) >>> 0)
    return Buffer.concat([length,body,crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6
  const pixels = Buffer.alloc(height*(width*4+1))
  const rgb=[1,3,5].map(at=>parseInt(color.slice(at,at+2),16))
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) pixels.set([...rgb,190],y*(width*4+1)+1+x*4)
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64')
}
const payload = (extra={}) => ({id:randomUUID(),x:12,y:16,width:2,height:2,color:'#a52d2b',image:png(2,2,extra.color ?? '#a52d2b'),...extra})
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(),'stamp-api-'))
  let server = createBoardServer(join(dir,'board.sqlite'))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let url = `http://127.0.0.1:${server.address().port}`
  const close = () => new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})
  t.after(async()=>{await close();rmSync(dir,{recursive:true,force:true})})
  const session = async () => (await fetch(`${url}/session`,{method:'POST'}).then(r=>r.json())).token
  const post = (value,token,method='POST') => fetch(`${url}/contributions`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(value)})
  return {session,post,get:path=>fetch(`${url}${path}`),seed:(count,token)=>{
    const db=new DatabaseSync(join(dir,'board.sqlite'))
    const insert=db.prepare('INSERT INTO contributions (id,owner,x,y,width,height,color,image,created_at) VALUES (?,?,12,16,2,2,?,?,?)')
    db.exec('BEGIN')
    for(let i=0;i<count;i++) insert.run(randomUUID(),token?createHash('sha256').update(token).digest('hex'):randomUUID(),'#a52d2b',png(),new Date(Date.now()-120000).toISOString())
    db.exec('COMMIT');db.close()
  },restart:async()=>{await close();server=createBoardServer(join(dir,'board.sqlite'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`}}
}
test('independent concurrent layers persist on disk and public reads reveal no owner or credentials',async t=>{
  const api=await fixture(t),a=await api.session(),b=await api.session()
  const one=payload(),two=payload({x:20,color:'#33466d'})
  const responses=await Promise.all([api.post(one,a),api.post(two,b)])
  assert.deepEqual(responses.map(r=>r.status),[200,200])
  await api.restart()
  const board=await api.get('/contributions').then(r=>r.json())
  assert.equal(board.total,2);assert.equal(board.contributions.length,2)
  assert.equal(board.contributions[0].sequence+1,board.contributions[1].sequence)
  assert.equal('owner' in board.contributions[0],false);assert.equal('image' in board.contributions[0],false)
  const image=await api.get(`/image/${one.id}`)
  assert.equal(image.headers.get('content-type'),'image/png')
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),one.image)
})
test('retry is idempotent, other sessions cannot replace a layer, and no edit/delete endpoint exists',async t=>{
  const api=await fixture(t),token=await api.session(),other=await api.session(),value=payload()
  const first=await api.post(value,token).then(r=>r.json())
  assert.deepEqual(await api.post(value,token).then(r=>r.json()),first)
  assert.equal((await api.post(value,other)).status,409)
  assert.equal((await api.post({...value,x:3},token)).status,409)
  assert.equal((await api.post(value,token,'DELETE')).status,404)
  assert.equal((await api.post(value,token,'PUT')).status,404)
  assert.equal((await api.get('/contributions').then(r=>r.json())).total,1)
})
test('authentication, finite bounds, file size, PNG integrity and per-session rates are enforced',async t=>{
  const api=await fixture(t),token=await api.session()
  assert.equal((await api.post(payload(),'')).status,401)
  for(const value of [payload({x:-1}),payload({y:1600}),payload({width:3}),payload({id:'bad'}),payload({color:'red'}),payload({image:btoa('<svg onload="alert(1)"/>')}),payload({image:png().slice(0,-8)})]) assert.equal((await api.post(value,token)).status,400)
  assert.equal((await api.post(payload({image:png(2,2,'#ffffff')}),token)).status,400)
  assert.equal((await api.post(payload({image:'A'.repeat(350000)}),token)).status,413)
  for(let i=0;i<3;i++) assert.equal((await api.post(payload(),token)).status,200)
  assert.equal((await api.post(payload(),token)).status,429)
  assert.equal((await api.get('/contributions?after=-1')).status,400)
})
test('daily and whole-board caps stay atomic when two requests compete for the last space',async t=>{
  const api=await fixture(t),a=await api.session(),b=await api.session()
  api.seed(20,a)
  assert.equal((await api.post(payload(),a)).status,429)
  api.seed(491)
  const c=await api.session()
  const statuses=await Promise.all([api.post(payload(),b),api.post(payload(),c)]).then(rows=>rows.map(r=>r.status).sort())
  assert.deepEqual(statuses,[200,409])
  assert.equal((await api.get('/contributions').then(r=>r.json())).total,512)
  assert.equal((await api.get('/contributions?after=500').then(r=>r.json())).contributions.length,12)
})
