export const DOCUMENT_PAPER = '#fff8e7'
export const STAMP_TARGET = { x: 1370, y: 850, radius: 175 }

/** The illustrated form is shared by the live desk and the PNG export. */
export function drawDocument(ctx: CanvasRenderingContext2D, number: number) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = DOCUMENT_PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#504c40'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(47, 54); ctx.lineTo(1747, 48); ctx.lineTo(1753, 1148)
  ctx.lineTo(51, 1153); ctx.closePath(); ctx.stroke()

  ctx.fillStyle = '#eadcae'
  ctx.beginPath(); ctx.roundRect(105, 102, 85, 85, 18); ctx.fill()
  ctx.strokeStyle = '#6a6044'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(147, 144, 23, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(147, 109); ctx.lineTo(147, 179)
  ctx.moveTo(112, 144); ctx.lineTo(182, 144); ctx.stroke()
  ctx.fillStyle = '#514e40'; ctx.font = '600 19px sans-serif'
  ctx.fillText('THE DEPARTMENT OF LITTLE THINGS', 218, 135)
  ctx.font = '16px monospace'; ctx.fillStyle = '#9b9076'
  ctx.fillText('A SMALL REQUEST / A PERSONAL SEAL', 218, 170)
  ctx.textAlign = 'right'; ctx.fillStyle = '#6c6958'
  ctx.font = '19px monospace'; ctx.fillText(`FORM ${String(number).padStart(3, '0')}`, 1667, 132)
  ctx.font = '15px monospace'; ctx.fillText('FOR YOUR CONSIDERATION', 1667, 167)
  ctx.textAlign = 'left'
  ctx.strokeStyle = '#bdb28f'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(105, 222); ctx.lineTo(1680, 218); ctx.stroke()

  ctx.font = 'italic 76px Georgia'; ctx.fillStyle = '#45483b'
  ctx.fillText('A little request.', 108, 337)
  ctx.font = '21px sans-serif'; ctx.fillStyle = '#9a917a'
  ctx.fillText('Please leave your mark before filing.', 112, 382)

  const block = (x: number, y: number, width: number, height = 17, color = '#ded6bf') => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, width, height, 7); ctx.fill()
  }
  ctx.font = '16px monospace'; ctx.fillStyle = '#9b9076'; ctx.fillText('REGARDING', 112, 459)
  block(112, 483, 860, 28, '#c9c4ad')
  block(112, 555, 1320); block(112, 592, 1460); block(112, 629, 1110)
  block(112, 701, 850); block(112, 738, 790); block(112, 775, 630)
  ctx.strokeStyle = '#aaa28a'; ctx.lineWidth = 2.5
  ctx.strokeRect(115, 843, 24, 24)
  block(158, 847, 492, 14)
  ctx.strokeRect(115, 893, 24, 24)
  block(158, 897, 610, 14)

  ctx.save()
  ctx.translate(STAMP_TARGET.x, STAMP_TARGET.y); ctx.rotate(-.045)
  ctx.strokeStyle = '#c6ab7b'; ctx.lineWidth = 3; ctx.setLineDash([11, 12])
  ctx.beginPath(); ctx.arc(0, 0, STAMP_TARGET.radius, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([]); ctx.fillStyle = '#b99c6c'; ctx.textAlign = 'center'
  ctx.font = 'italic 31px Georgia'; ctx.fillText('stamp here', 0, 10)
  ctx.font = '12px monospace'; ctx.fillText('A LITTLE PRESSURE WILL DO', 0, 45)
  ctx.restore()
  ctx.strokeStyle = '#b5ab8d'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(112, 1039); ctx.lineTo(760, 1039); ctx.stroke()
  ctx.font = '15px monospace'; ctx.fillStyle = '#9a917a'; ctx.fillText('REVIEWED, IN YOUR OWN WAY', 112, 1075)
  ctx.textAlign = 'right'; ctx.font = '14px monospace'; ctx.fillText('ONE DOCUMENT / MANY POSSIBILITIES', 1667, 1080)
  ctx.textAlign = 'left'
}
