import type {
  Breakpoint,
  SceneElement,
  ShapeKind,
} from '../model/siteDocument';

export const FRAME_WIDTH: Record<Breakpoint, number> = {
  desktop: 1180,
  tablet: 768,
  mobile: 390,
};

export const PAINT_COLORS = {
  coral: '#E98B5F',
  rose: '#E8A0B0',
  peach: '#F2C79A',
} as const;

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: 'Rectangle',
  square: 'Carré',
  circle: 'Cercle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  diamond: 'Losange',
  star: 'Étoile',
  line: 'Ligne',
};

export function elementLabel(element: SceneElement): string {
  switch (element.type) {
    case 'text':
      return element.text['fr-CA'] || 'Texte';
    case 'paint':
      return `Peinture · ${element.assetKey}`;
    case 'image':
      return element.source.kind === 'placeholder' ? element.source.label : 'Image';
    case 'button':
      return element.label['fr-CA'] || 'Bouton';
    case 'shape':
      return SHAPE_LABELS[element.shapeKind];
  }
}

export function elementSwatch(element: SceneElement): string {
  if (element.type === 'paint') return element.customColor ?? PAINT_COLORS[element.assetKey];
  if (element.type === 'shape') {
    return element.shapeKind === 'line' ? element.strokeColor : element.fillColor;
  }
  if (element.type === 'button') return '#E8A54B';
  if (element.type === 'image') return '#7B83A0';
  return '#5B6270';
}