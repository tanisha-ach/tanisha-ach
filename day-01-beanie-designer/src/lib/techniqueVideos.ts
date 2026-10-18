/** Curated YouTube tutorials (VeryPink Knits, Purl Soho, and similar) for techniques in the pattern. */
export const TECHNIQUE_VIDEOS: Record<string, string> = {
  'Knit in the round': 'https://www.youtube.com/watch?v=pIfc_i7zGdw',
  'Reading a colorwork chart': 'https://www.youtube.com/watch?v=S5VqzYMfvMk',
  'Stranded colorwork (carrying floats)': 'https://www.youtube.com/watch?v=34NfttcT7_M',
  'Knit/purl ribbing': 'https://www.youtube.com/watch?v=1mqIqRdJc68',
  'Slip stitches purlwise with yarn in back': 'https://www.youtube.com/watch?v=9CTnjLFKFQA',
  'Provisional cast-on': 'https://www.youtube.com/watch?v=0wkQRG4Tmv4',
  'Hemming a cuff': 'https://www.youtube.com/watch?v=cP0RBwA9CkE',
  'Folding a cuff': 'https://www.youtube.com/watch?v=1mqIqRdJc68',
  'Leaving a rolled stockinette edge': 'https://www.youtube.com/watch?v=pIfc_i7zGdw',
  'k2tog decreases': 'https://www.youtube.com/watch?v=10Ko-GJ8Vbk',
  'ssk decreases': 'https://www.youtube.com/watch?v=Cg1ykku04is',
  'Increases (m1 / RLI / LLI / kfb)': 'https://www.youtube.com/watch?v=IlPQBhZ31B4',
  'Double-pointed needles or Magic Loop': 'https://www.youtube.com/watch?v=1mqIqRdJc68',
};

export function videoForTechnique(name: string): string | undefined {
  return TECHNIQUE_VIDEOS[name];
}
