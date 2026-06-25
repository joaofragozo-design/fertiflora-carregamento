import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src  = join(root, 'public', 'fertiflora-logo.png')
const dir  = join(root, 'public', 'icons')

if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(join(dir, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}
