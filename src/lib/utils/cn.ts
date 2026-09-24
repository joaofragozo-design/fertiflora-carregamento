import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge não reconhece `text-fluid-title`/`text-fluid-hero` (os tokens
// de tipografia fluida do tailwind.config.ts) como tamanho de fonte — sem essa
// extensão ele os classifica no grupo de conflito errado e a classe de COR
// (ex.: text-industrial-900), por vir depois na string, vence e descarta o
// tamanho fluido silenciosamente.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['fluid-title', 'fluid-hero'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
