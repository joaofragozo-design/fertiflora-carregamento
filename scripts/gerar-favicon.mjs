// Gera src/app/icon.png (favicon) a partir da folha em public/fertiflora-mark.png.
// O mark original (330x463) tem uma lasca de outro elemento na borda direita —
// recorta fora, apara as bordas transparentes e centraliza num quadrado.
import sharp from 'sharp'

const ORIGEM = 'public/fertiflora-mark.png'
const DESTINO = 'src/app/icon.png'

const meta = await sharp(ORIGEM).metadata()
console.log(`origem: ${meta.width}x${meta.height}`)

// a lasca fica nos ~12% finais da largura; extract e trim precisam de
// pipelines separados (no mesmo pipeline o sharp aplica o trim primeiro)
const recorte = await sharp(ORIGEM)
  .extract({ left: 0, top: 0, width: Math.round(meta.width * 0.88), height: meta.height })
  .png()
  .toBuffer()
const folha = await sharp(recorte).trim({ threshold: 40 }).png().toBuffer()

const { width, height } = await sharp(folha).metadata()
const lado = Math.round(Math.max(width, height) * 1.14)

const quadrado = await sharp({
  create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: folha, left: Math.round((lado - width) / 2), top: Math.round((lado - height) / 2) }])
  .png()
  .toBuffer()

await sharp(quadrado).resize(512, 512).png().toFile(DESTINO)

console.log(`ok: ${DESTINO} (folha ${width}x${height} em canvas ${lado}px → 512px)`)
