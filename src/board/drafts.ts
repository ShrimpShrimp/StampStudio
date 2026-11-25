import type { Draft } from './types'

const KEY = 'shared-board-draft-v1'
let opening: Promise<IDBDatabase> | undefined
function database() {
  return opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('make-your-mark', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function readDraft(): Promise<Draft | null> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get(KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}
export async function saveDraft(value: Draft | null) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite')
    const store = transaction.objectStore('drafts')
    if (value) store.put(value, KEY)
    else store.delete(KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
