export const WIDTH = 2400, HEIGHT = 1600, MAX_BYTES = 262144, MAX_LAYERS = 512
export const COLORS = ['#a52d2b', '#33466d', '#386557', '#aa762b']
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class BoardError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
const fail = message => { throw new BoardError(message) }
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1
  return n >>> 0
})
function crc(bytes) {
  let n = 0xffffffff
  for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ n >>> 8
  return (n ^ 0xffffffff) >>> 0
}
export async function validateSubmission(value) {
  if (!value || typeof value !== 'object' || !UUID.test(value.id)) fail('Invalid contribution ID.')
  const { id, x, y, width, height, color, image } = value
  if (![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || width < 1 || height < 1 || x + width > WIDTH || y + height > HEIGHT) fail('Keep your contribution inside the board.')
  if (!COLORS.includes(color)) fail('Choose one of the board inks.')
  if (typeof image !== 'string' || image.length > Math.ceil(MAX_BYTES / 3) * 4) throw new BoardError('This draft is too large. Please undo some marks or start a smaller draft.', 413)
  if (!image.length || image.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)) fail('Invalid PNG encoding.')
  const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0))
  if (bytes.length > MAX_BYTES || bytes.length < 57 || ![137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) fail('A PNG image is required.')
  const view = new DataView(bytes.buffer), chunks = []
  let offset = 8, header = false, ended = false, channels = 0
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('Incomplete PNG.')
    const length = view.getUint32(offset), end = offset + 12 + length
    if (end > bytes.length) fail('Incomplete PNG chunk.')
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (view.getUint32(end - 4) !== crc(bytes.subarray(offset + 4, end - 4))) fail('Damaged PNG.')
    if (!header && type !== 'IHDR') fail('Invalid PNG header.')
    if (type === 'IHDR') {
      if (header || length !== 13 || view.getUint32(offset + 8) !== width || view.getUint32(offset + 12) !== height) fail('PNG dimensions do not match the draft.')
      channels = bytes[offset + 17] === 6 ? 4 : 0
      if (bytes[offset + 16] !== 8 || !channels || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20]) fail('Use a standard, non-interlaced canvas PNG.')
      header = true
    } else if (type === 'IDAT') {
      chunks.push(bytes.slice(offset + 8, end - 4))
    } else if (type === 'IEND') {
      if (length || !chunks.length || end !== bytes.length) fail('Invalid PNG ending.')
      ended = true
    } else {
      const safeMetadata = { sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 }
      if (safeMetadata[type] !== length || chunks.length) fail('Unsupported PNG chunk.')
    }
    offset = end
  }
  if (!ended) fail('Incomplete PNG.')
  // Bound decompression to the declared pixel dimensions; never trust a tiny compressed file.
  const expected = (width * channels + 1) * height
  const reader = new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  const stride = width * channels, row = new Uint8Array(stride + 1), previous = new Uint8Array(stride)
  const rgb = [1,3,5].map(at => parseInt(color.slice(at,at+2),16))
  let decoded = 0, rowOffset = 0, hasInk = false
  const paeth = (a,b,c) => { const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c }
  function checkRow() {
    const filter = row[0]
    if (filter > 4) fail('Invalid PNG row filter.')
    for (let x=0;x<stride;x++) {
      const a = x>=4 ? row[x-3] : 0, b = previous[x], c = x>=4 ? previous[x-4] : 0
      row[x+1] = (row[x+1] + (filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0)) & 255
    }
    for (let x=0;x<stride;x+=4) {
      const alpha = row[x+4]
      if (!alpha) continue
      hasInk = true
      // Canvas unpremultiplication introduces larger RGB rounding at very low alpha.
      const tolerance = Math.ceil(255/alpha)+2
      if ([0,1,2].some(c=>Math.abs(row[x+c+1]-rgb[c])>tolerance)) fail('The layer must contain only the selected stamp ink and transparency.')
    }
    previous.set(row.subarray(1))
  }
  try {
    while (true) {
      const { done, value: part } = await reader.read()
      if (done) break
      if (decoded + part.length > expected) fail('Invalid PNG pixel data.')
      let at = 0
      while (at < part.length) {
        const count = Math.min(row.length-rowOffset,part.length-at)
        row.set(part.subarray(at,at+count),rowOffset); rowOffset+=count; at+=count
        if (rowOffset === row.length) { checkRow(); rowOffset=0 }
      }
      decoded += part.length
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof BoardError) throw error
    fail('PNG pixel data could not be read.')
  }
  if (decoded !== expected) fail('Incomplete PNG pixel data.')
  if (!hasInk) fail('The draft has no ink yet.')
  return { id, x, y, width, height, color, image }
}
