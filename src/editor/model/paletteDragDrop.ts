import { patchPlacement, resolvePlacement } from './documentOps';
import type {
  Breakpoint,
  Placement,
  SceneElement,
  ShapeKind,
} from './siteDocument';

export const PALETTE_TOOL_MIME = 'application/x-tresh-tool';
export const PALETTE_DRAG_END_EVENT = 'tresh:palette-drag-end';

export type PaletteToolId =
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'paint'
  | 'shape';

const PALETTE_TOOL_IDS = new Set<PaletteToolId>([
  'heading',
  'text',
  'button',
  'image',
  'paint',
  'shape',
]);

const FIXED_RATIO_SHAPES = new Set<ShapeKind>([
  'square',
  'circle',
  'triangle',
  'diamond',
  'star',
]);

export interface DropPoint {
  clientX: number;
  clientY: number;
}

export interface DropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isPaletteToolId(
  value: string | null,
): value is PaletteToolId {
  return value !== null && PALETTE_TOOL_IDS.has(value as PaletteToolId);
}

export function hasPaletteToolTransfer(
  types: Iterable<string>,
): boolean {
  return Array.from(types).includes(PALETTE_TOOL_MIME);
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function estimateElementHeightPercent(
  element: SceneElement,
  placement: Placement,
  sectionRect: DropRect,
): number {
  if (
    element.type === 'shape' &&
    !FIXED_RATIO_SHAPES.has(element.shapeKind)
  ) {
    return placement.heightPercent ?? 18;
  }

  if (
    element.type === 'paint' ||
    (
      element.type === 'shape' &&
      FIXED_RATIO_SHAPES.has(element.shapeKind)
    )
  ) {
    return (
      (placement.widthPercent / 100) *
      sectionRect.width /
      Math.max(sectionRect.height, 1) *
      100
    );
  }

  if (element.type === 'image') {
    const aspectRatio = Math.max(element.aspectRatio ?? 0.82, 0.1);

    return (
      (placement.widthPercent / 100) *
      sectionRect.width /
      aspectRatio /
      Math.max(sectionRect.height, 1) *
      100
    );
  }

  if (element.type === 'button') {
    return (44 / Math.max(sectionRect.height, 1)) * 100;
  }

  if (element.type !== 'text') {
    return (32 / Math.max(sectionRect.height, 1)) * 100;
  }

  const fontSize = placement.fontSize ?? 17;
  const text = element.text['fr-CA'] ?? '';
  const lineCount = Math.max(1, text.split(/\r?\n/).length);

  return (
    (fontSize * Math.max(1.5, lineCount * 1.35)) /
    Math.max(sectionRect.height, 1) *
    100
  );
}

export function placePaletteElementAtPoint(
  element: SceneElement,
  breakpoint: Breakpoint,
  point: DropPoint,
  sectionRect: DropRect,
): SceneElement {
  const placement = resolvePlacement(element.placement, breakpoint);
  const rawX =
    ((point.clientX - sectionRect.left) /
      Math.max(sectionRect.width, 1)) *
    100;
  const rawY =
    ((point.clientY - sectionRect.top) /
      Math.max(sectionRect.height, 1)) *
    100;

  const halfWidth = clamp(placement.widthPercent / 2, 0, 50);
  const halfHeight = clamp(
    estimateElementHeightPercent(
      element,
      placement,
      sectionRect,
    ) / 2,
    0,
    50,
  );

  const xPercent = clamp(rawX, halfWidth, 100 - halfWidth);
  const yPercent = clamp(rawY, halfHeight, 100 - halfHeight);

  return {
    ...element,
    placement: patchPlacement(
      element.placement,
      breakpoint,
      {
        xPercent,
        yPercent,
      },
    ),
  };
}
