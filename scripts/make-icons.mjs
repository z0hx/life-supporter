// 192/512px のプレースホルダーアイコン(テラコッタ地に生成りの丸)を生成する
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = ~0
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (~c) >>> 0
}
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const BG = [0xd9, 0x77, 0x57] // #D97757
const FG = [0xfa, 0xf6, 0xf0] // #FAF6F0

function png(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  const raw = Buffer.alloc(size * (1 + size * 3))
  const c = (size - 1) / 2
  const r = size * 0.3
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r
      const [rr, gg, bb] = inside ? FG : BG
      const p = row + 1 + x * 3
      raw[p] = rr
      raw[p + 1] = gg
      raw[p + 2] = bb
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(pub, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(pub, `icon-${size}.png`), png(size))
  console.log(`public/icon-${size}.png`)
}
