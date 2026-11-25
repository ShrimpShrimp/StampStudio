export const BOARD_WIDTH = 2400
export const BOARD_HEIGHT = 1600
export const INKS = [
  { name: 'Seal red', value: '#a52d2b' },
  { name: 'Indigo', value: '#33466d' },
  { name: 'Forest', value: '#386557' },
  { name: 'Ochre', value: '#aa762b' },
] as const

export type Contribution = {
  id: string
  sequence: number
  x: number
  y: number
  width: number
  height: number
  color: string
  created_at: string
}
export type Draft = {
  blob: Blob
  x: number
  y: number
  width: number
  height: number
  count: number
  color: string
  id: string
  pending?: boolean
}
export type Submission = Omit<Draft, 'blob' | 'count' | 'pending'> & { image: string }
