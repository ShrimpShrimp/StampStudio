import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BoardError, MAX_LAYERS, UUID, validateSubmission } from '../supabase/functions/_shared/validation.mjs'

export function createBoardServer(filename) {
  mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS contributions (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL,
      x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
      color TEXT NOT NULL, image TEXT NOT NULL, created_at TEXT NOT NULL
    );`)
  const fields = 'id, sequence, x, y, width, height, color, created_at'
  const digest = token => createHash('sha256').update(token).digest('hex')
  const server = createServer(async (req, res) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type,apikey', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' }
    const send = (status, data, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(data instanceof Uint8Array ? data : JSON.stringify(data)) }
    try {
      if (req.method === 'OPTIONS') return send(204, null)
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      if (req.method === 'POST' && path === '/session') {
        const count = db.prepare('SELECT count(*) AS n FROM sessions WHERE created_at > ?').get(new Date(Date.now()-60000).toISOString()).n
        if (count >= 30) throw new BoardError('Please wait a minute before starting another session.', 429)
        const token = randomBytes(32).toString('hex')
        db.prepare('INSERT INTO sessions VALUES (?,?)').run(digest(token), new Date().toISOString())
        return send(200, { token })
      }
      if (req.method === 'GET' && path === '/contributions') {
        const after = Number(url.searchParams.get('after') ?? 0)
        if (!Number.isSafeInteger(after) || after < 0) throw new BoardError('Invalid page.')
        const rows = db.prepare(`SELECT ${fields} FROM contributions WHERE sequence > ? ORDER BY sequence LIMIT 101`).all(after)
        return send(200, { contributions: rows.slice(0, 100), hasMore: rows.length > 100, total: db.prepare('SELECT count(*) AS n FROM contributions').get().n }, { 'Cache-Control': 'no-store' })
      }
      if (req.method === 'GET' && path.startsWith('/image/')) {
        const id = path.slice(7)
        if (!UUID.test(id)) throw new BoardError('Invalid contribution ID.')
        const row = db.prepare('SELECT image FROM contributions WHERE id=?').get(id)
        if (!row) throw new BoardError('Contribution not found.', 404)
        return send(200, Buffer.from(row.image, 'base64'), { 'Content-Type': 'image/png', 'Cache-Control': 'public,max-age=31536000,immutable' })
      }
      if (req.method !== 'POST' || path !== '/contributions') throw new BoardError('Route not found.', 404)
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
      const owner = digest(token)
      if (!db.prepare('SELECT token FROM sessions WHERE token=?').get(owner)) throw new BoardError('An anonymous session is required.', 401)
      let size = 0, body = ''
      for await (const chunk of req) {
        size += chunk.length
        if (size > 355000) throw new BoardError('This draft is too large.', 413)
        body += chunk.toString()
      }
      let parsed
      try { parsed = JSON.parse(body) } catch { throw new BoardError('Invalid request.') }
      const value = await validateSubmission(parsed)
      // No await inside the transaction: concurrent requests cannot overwrite a layer.
      db.exec('BEGIN IMMEDIATE')
      try {
        const existing = db.prepare('SELECT * FROM contributions WHERE id=?').get(value.id)
        if (existing) {
          if (existing.owner !== owner || !['x','y','width','height','color','image'].every(k => existing[k] === value[k])) throw new BoardError('That contribution ID already belongs to another draft.', 409)
        } else {
          const total = db.prepare('SELECT count(*) AS n FROM contributions').get().n
          if (total >= MAX_LAYERS) throw new BoardError('This board is full. Your draft is still yours to keep.', 409)
          const recent = db.prepare('SELECT created_at FROM contributions WHERE owner=?').all(owner)
          const now = Date.now()
          if (recent.filter(r => now - Date.parse(r.created_at) < 60000).length >= 3 || recent.filter(r => now - Date.parse(r.created_at) < 86400000).length >= 20) throw new BoardError('Please pause before sharing more marks. Your draft is saved.', 429)
          db.prepare('INSERT INTO contributions (id,owner,x,y,width,height,color,image,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(value.id,owner,value.x,value.y,value.width,value.height,value.color,value.image,new Date().toISOString())
        }
        const row = db.prepare(`SELECT ${fields} FROM contributions WHERE id=?`).get(value.id)
        db.exec('COMMIT')
        return send(200, row)
      } catch (error) { db.exec('ROLLBACK'); throw error }
    } catch (error) {
      if (!(error instanceof BoardError)) console.error(error)
      send(error instanceof BoardError ? error.status : 500, { error: error instanceof BoardError ? error.message : 'The board could not save your draft. Please retry.' })
    }
  })
  server.on('close', () => db.close())
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.BOARD_PORT ?? 8787)
  createBoardServer(resolve(process.env.BOARD_DB ?? '.local/board.sqlite')).listen(port, '127.0.0.1', () => console.log(`Local shared board listening on http://127.0.0.1:${port}`))
}
