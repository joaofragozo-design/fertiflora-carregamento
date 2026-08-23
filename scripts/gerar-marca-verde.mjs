// Gera a marca verde a partir da marca roxa do STO (mesma folha, mesmo
// recorte): amostra a cor do traço e do fundo do ícone PWA do STO, gira o
// matiz para o verde Fertiflora mantendo saturação/luminosidade, e produz:
//   public/fertiflora-mark-verde.png  (folha recolorida, alpha preservado)
//   src/app/icon.png                  (favicon 512, folha centrada, fundo transparente)
//   public/icons/icon-192.png / icon-512.png (folha sobre fundo escuro, padrão STO)
import sharp from 'sharp'

const STO_MARK = 'C:/Projetos/FertiFloraSTO/public/fertiflora-mark-roxo.png'
const STO_ICON = 'C:/Projetos/FertiFloraSTO/public/icons/icon-512.png'
const HUE_VERDE = 113 // matiz do verde Fertiflora (brand-500 #4FB142)

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h, s, l) {
  h /= 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255))
}

/** Cor média (ponderada por alpha quando houver) de uma imagem. */
async function corMedia(path, { soOpacos = false } = {}) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let r = 0, g = 0, b = 0, peso = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3] / 255
    if (soOpacos && a < 0.99) continue
    r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; peso += a
  }
  return [r / peso, g / peso, b / peso]
}

function girarParaVerde([r, g, b]) {
  const [, s, l] = rgbToHsl(r, g, b)
  return hslToRgb(HUE_VERDE, s, l)
}

// 1. Cor do traço: média ponderada da folha roxa → mesma S/L em verde
const lilas = await corMedia(STO_MARK)
const [vr, vg, vb] = girarParaVerde(lilas)
console.log(`traço: lilás rgb(${lilas.map(Math.round).join(',')}) → verde rgb(${vr},${vg},${vb})`)

// 2. Recolore a folha: cor sólida verde + alpha original (antialias preservado)
const meta = await sharp(STO_MARK).metadata()
const alpha = await sharp(STO_MARK).ensureAlpha().extractChannel('alpha').toBuffer()
const folhaVerde = await sharp({
  create: { width: meta.width, height: meta.height, channels: 3, background: { r: vr, g: vg, b: vb } },
})
  .joinChannel(alpha)
  .png()
  .toBuffer()
await sharp(folhaVerde).toFile('public/fertiflora-mark-verde.png')
console.log(`ok: public/fertiflora-mark-verde.png (${meta.width}x${meta.height})`)

// 3. Favicon: folha centrada em quadrado transparente, 512px
const lado = Math.round(Math.max(meta.width, meta.height) * 1.14)
const quadrado = await sharp({
  create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: folhaVerde, left: Math.round((lado - meta.width) / 2), top: Math.round((lado - meta.height) / 2) }])
  .png()
  .toBuffer()
await sharp(quadrado).resize(512, 512).png().toFile('src/app/icon.png')
console.log('ok: src/app/icon.png (512)')

// 4. Ícones do app instalado (PWA/Apple): folha verde-clara centrada na zona
//    segura maskable (~58% da altura) sobre fundo VERDE-OLIVA ESCURO — o tom
//    do tema do app, escolhido pelo usuário (não o roxo girado do STO).
const FUNDO_ICONE = { r: 0x33, g: 0x3d, b: 0x20 } // #333D20 — oliva escuro

async function gerarIcone(tam, destino) {
  const alturaFolha = Math.round(tam * 0.58)
  const larguraFolha = Math.round(alturaFolha * (meta.width / meta.height))
  const folhaMenor = await sharp(folhaVerde).resize(larguraFolha, alturaFolha).png().toBuffer()
  await sharp({
    create: { width: tam, height: tam, channels: 4, background: { ...FUNDO_ICONE, alpha: 1 } },
  })
    .composite([{ input: folhaMenor, left: Math.round((tam - larguraFolha) / 2), top: Math.round((tam - alturaFolha) / 2) }])
    .png()
    .toFile(destino)
  console.log(`ok: ${destino}`)
}

await gerarIcone(192, 'public/icons/icon-192.png')
await gerarIcone(512, 'public/icons/icon-512.png')
await gerarIcone(180, 'src/app/apple-icon.png') // iPhone "adicionar à tela de início"
