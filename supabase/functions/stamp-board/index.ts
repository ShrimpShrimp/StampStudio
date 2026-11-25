import { createClient } from 'npm:@supabase/supabase-js@2.119.2'
import { BoardError, UUID, validateSubmission } from '../_shared/validation.mjs'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
const fields = 'id,sequence,x,y,width,height,color,created_at'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const publicRow = (row: Record<string, unknown>) => Object.fromEntries(fields.split(',').map(k => [k, row[k]]))
Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const url = new URL(req.url), path = url.pathname.replace(/^\/stamp-board/, '')
    if (req.method === 'GET' && path === '/contributions') {
      const after = Number(url.searchParams.get('after') ?? 0)
      if (!Number.isSafeInteger(after) || after < 0) throw new BoardError('Invalid page.')
      const { data, error, count } = await admin.from('stamp_contributions').select(fields, { count: 'exact' }).gt('sequence', after).order('sequence').limit(101)
      if (error) throw error
      const { count: total, error: countError } = await admin.from('stamp_contributions').select('id', { count: 'exact', head: true })
      if (countError) throw countError
      return json({ contributions: data.slice(0,100), hasMore: (count ?? 0) > 100, total })
    }
    if (req.method === 'GET' && path.startsWith('/image/')) {
      const id = path.slice(7)
      if (!UUID.test(id)) throw new BoardError('Invalid contribution ID.')
      const { data, error } = await admin.from('stamp_contributions').select('image_base64').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) throw new BoardError('Contribution not found.',404)
      return new Response(Uint8Array.from(atob(data.image_base64), c => c.charCodeAt(0)), { headers: { ...cors, 'Content-Type': 'image/png', 'Cache-Control': 'public,max-age=31536000,immutable' } })
    }
    if (req.method !== 'POST' || path !== '/contributions') throw new BoardError('Route not found.',404)
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
    if (!token) throw new BoardError('An anonymous session is required.',401)
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) throw new BoardError('Your session expired. Please refresh and retry; your draft is saved.',401)
    // Bound bytes while reading, including requests without a Content-Length header.
    const reader = req.body?.getReader(); let size = 0; const parts: ArrayBuffer[] = []
    if (!reader) throw new BoardError('Empty request.')
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.length
      if (size > 355000) { await reader.cancel(); throw new BoardError('This draft is too large.',413) }
      parts.push(value.slice().buffer)
    }
    let parsed
    try { parsed = JSON.parse(await new Blob(parts).text()) } catch { throw new BoardError('Invalid request.') }
    const value = await validateSubmission(parsed)
    const { data, error } = await admin.rpc('submit_stamp_contribution', { p_owner: user.id, p_id: value.id, p_x: value.x, p_y: value.y, p_width: value.width, p_height: value.height, p_color: value.color, p_image: value.image })
    if (error) {
      if (error.message === 'rate') throw new BoardError('Please pause before sharing more marks. Your draft is saved.',429)
      if (error.message === 'full') throw new BoardError('This board is full. Your draft is still yours to keep.',409)
      if (error.message === 'conflict') throw new BoardError('That contribution ID already belongs to another draft.',409)
      throw error
    }
    return json(publicRow(data[0]))
  } catch (error) {
    if (!(error instanceof BoardError)) console.error('Stamp board request failed', error)
    return json({ error: error instanceof BoardError ? error.message : 'The board could not save your draft. Please retry.' }, error instanceof BoardError ? error.status : 500)
  }
})
