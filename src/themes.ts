/** Quizlet-adjacent brand palette. */
export const QZ = {
  indigo: '#4255FF',
  deepIndigo: '#423ED8',
  yellow: '#FFCD1F',
  navy: '#0A092D',
  slate: '#282E3E',
  offWhite: '#F6F7FB',
} as const;

export type TreeStyle = 'acacia' | 'broadleaf' | 'cedar';
export type DecorKind = 'cactus' | 'rock' | 'tuft' | 'palm' | 'bush' | 'flower' | 'pine' | 'fern';

export interface Hill {
  base: number;
  color: string;
  waves: [amp: number, freq: number][];
  ridge?: string;
  snow?: boolean;
  pines?: boolean;
}

export interface Theme {
  name: 'desert' | 'tropical' | 'cedar-forest';
  sky: string[]; // top → horizon
  sun: string;
  sunCore: string;
  cloud: string;
  cloudShade: string;
  hills: Hill[]; // back → front
  ground: string;
  groundLight: string;
  groundDark: string;
  cliff: string;
  cliffLight: string;
  cliffDark: string;
  water: string;
  waterLight: string;
  foam: string;
  trunk: string;
  trunkLight: string;
  trunkDark: string;
  leaf: string;
  leafLight: string;
  leafDark: string;
  accent: string;
  tree: TreeStyle;
  decor: DecorKind[];
}

export const THEMES: Theme[] = [
  {
    name: 'desert',
    sky: ['#7F8CFF', '#A9B2FF', '#FFD98A', '#FFE7B3'],
    sun: QZ.yellow,
    sunCore: '#FFF3C4',
    cloud: QZ.offWhite,
    cloudShade: '#D9DCF5',
    hills: [
      { base: 176, color: '#EDB873', waves: [[10, 0.011], [4, 0.034]], ridge: '#F7D29A' },
      { base: 204, color: '#E0A35F', waves: [[7, 0.017], [3, 0.05]], ridge: '#EDB873' },
    ],
    ground: '#F2C877',
    groundLight: '#FFE0A0',
    groundDark: '#D9A452',
    cliff: '#C7743E',
    cliffLight: '#E0905A',
    cliffDark: '#8F4E2A',
    water: QZ.indigo,
    waterLight: '#8C9BFF',
    foam: QZ.offWhite,
    trunk: '#7A4A2A',
    trunkLight: '#9C6438',
    trunkDark: '#4E2E1A',
    leaf: '#7FA83A',
    leafLight: '#A8CC5A',
    leafDark: '#55752A',
    accent: QZ.yellow,
    tree: 'acacia',
    decor: ['cactus', 'cactus', 'rock', 'rock', 'tuft'],
  },
  {
    name: 'tropical',
    sky: [QZ.indigo, '#6F86FF', '#9FD4FF', '#D6F1FF'],
    sun: QZ.yellow,
    sunCore: '#FFF3C4',
    cloud: QZ.offWhite,
    cloudShade: '#C9D6F5',
    hills: [
      { base: 160, color: '#3C9C8C', waves: [[16, 0.013], [6, 0.04]] },
      { base: 190, color: '#2B8A62', waves: [[9, 0.02], [4, 0.06]], ridge: '#3FAF78' },
    ],
    ground: '#3FB36B',
    groundLight: '#6FD38E',
    groundDark: '#2A8A50',
    cliff: '#5C6B7A',
    cliffLight: '#7D8C9B',
    cliffDark: '#3D4955',
    water: '#3D7BFF',
    waterLight: '#9CC2FF',
    foam: QZ.offWhite,
    trunk: '#8A5A3B',
    trunkLight: '#A9714C',
    trunkDark: '#5C3A25',
    leaf: '#22A35A',
    leafLight: '#4CD07D',
    leafDark: '#157A40',
    accent: QZ.yellow,
    tree: 'broadleaf',
    decor: ['palm', 'bush', 'bush', 'flower', 'rock'],
  },
  {
    name: 'cedar-forest',
    sky: [QZ.deepIndigo, '#6F6BEA', '#B9C0FF', '#E6E9FF'],
    sun: QZ.offWhite,
    sunCore: '#FFFFFF',
    cloud: QZ.offWhite,
    cloudShade: '#C3C8F0',
    hills: [
      { base: 150, color: '#6A74B0', waves: [[30, 0.009], [12, 0.028]], snow: true },
      { base: 192, color: '#2E4F3A', waves: [[8, 0.02], [3, 0.07]], pines: true },
    ],
    ground: '#4C7A3E',
    groundLight: '#6E9C55',
    groundDark: '#355A2B',
    cliff: '#6B6F80',
    cliffLight: '#8D91A3',
    cliffDark: '#474A57',
    water: QZ.indigo,
    waterLight: '#9AA5FF',
    foam: QZ.offWhite,
    trunk: '#6B4430',
    trunkLight: '#8A5A40',
    trunkDark: '#45291C',
    leaf: '#2F5E3A',
    leafLight: '#447A4C',
    leafDark: '#1E3F27',
    accent: QZ.offWhite,
    tree: 'cedar',
    decor: ['pine', 'pine', 'fern', 'rock', 'flower'],
  },
];

export const pickTheme = (seed: number): Theme => THEMES[seed % THEMES.length];
