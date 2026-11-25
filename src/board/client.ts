import { createClient } from '@supabase/supabase-js'
import type { Contribution, Submission } from './types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const local = import.meta.env.DEV ? import.meta.env.VITE_BOARD_API_URL?.trim() : undefined
const supabase = url && key ? createClient(url, key) : null
const endpoint = supabase ? `${url}/functions/v1/stamp-board` : local

export const boardConnection = !endpoint ? 'unconfigured' : supabase ? 'hosted' : 'local'
let localToken: string | null = local ? localStorage.getItem('stamp-local-session') : null
export class BoardRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
async function authorization() {
  if (supabase) {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (session) return session.access_token
    const { data, error: signInError } = await supabase.auth.signInAnonymously()
    if (signInError) throw new Error('Could not start an anonymous session. Your draft is safe; please retry.')
    return data.session!.access_token
  }
  if (!localToken) {
    const response = await fetch(`${endpoint}/session`, { method: 'POST' })
    if (!response.ok) throw new Error('The local board server is unavailable.')
    localToken = (await response.json()).token
    localStorage.setItem('stamp-local-session', localToken!)
  }
  return localToken!
}

async function request(path: string, init?: RequestInit) {
  if (!endpoint) throw new Error('Shared storage is not connected yet.')
  const headers = new Headers(init?.headers)
  if (key && supabase) headers.set('apikey', key)
  if (init?.method === 'POST') {
    headers.set('Authorization', `Bearer ${await authorization()}`)
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${endpoint}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) {
    const message = await response.json().catch(() => null)
    if (response.status === 401 && local) { localToken = null; localStorage.removeItem('stamp-local-session') }
    throw new BoardRequestError(message?.error ?? 'The board could not be reached. Your local draft is safe.', response.status)
  }
  return response
}

export async function listContributions(after: number): Promise<{ contributions: Contribution[]; hasMore: boolean; total: number }> {
  return (await request(`/contributions?after=${after}`)).json()
}
export async function contributionImage(id: string) {
  return (await request(`/image/${encodeURIComponent(id)}`)).blob()
}
export async function submitContribution(value: Submission): Promise<Contribution> {
  return (await request('/contributions', { method: 'POST', body: JSON.stringify(value) })).json()
}
export async function encodePNG(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
