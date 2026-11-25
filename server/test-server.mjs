import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBoardServer } from './board.mjs'
const folder = mkdtempSync(join(tmpdir(),'stamp-browser-tests-'))
const server = createBoardServer(join(folder,'board.sqlite'))
server.listen(8788,'127.0.0.1')
let stopping = false
function close() {
  if (stopping) return
  stopping = true
  server.close(() => { rmSync(folder,{ recursive:true, force:true }); process.exit(0) })
  server.closeAllConnections()
}
process.on('SIGTERM',close); process.on('SIGINT',close)
