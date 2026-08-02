import { patchPlacement, resolvePlacement } from './documentOps';
import type {
  Breakpoint,
  ImageElement,
  ImageFit,
  Placement,
} from './siteDocument';

export interface ResolvedImageCrop {
  fit: ImageFit;
  focalX: number;
  focalY: number;
  frameHeightPercent?: number;
}

export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampImageFocal(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return clamp(value, 0, 100);
}

export function resolveImageCrop(
  element: ImageElement,
  breakpoint: Breakpoint,
): ResolvedImageCrop {
  const placement = resolvePlacement(element.placement, breakpoint);

  const frameHeightPercent = placement.heightPercent;

  return {
    fit: placement.imageFit ?? element.fit ?? 'cover',
    focalX: clampImageFocal(placement.imageFocalX ?? 50),
    focalY: clampImageFocal(placement.imageFocalY ?? 50),
    ...(frameHeightPercent === undefined
      ? {}
      : { frameHeightPercent }),
  };
}

export function focalPointFromClient(
  point: ClientPoint,
  rect: ClientRectLike,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 50, y: 50 };
  }

  return {
    x: clampImageFocal(
      ((point.clientX - rect.left) / rect.width) * 100,
    ),
    y: clampImageFocal(
      ((point.clientY - rect.top) / rect.height) * 100,
    ),
  };
}

export function intrinsicImageFrameHeightPercent(
  placement: Pick<Placement, 'widthPercent'>,
  aspectRatio: number | undefined,
  frameWidth: number,
  sectionHeight: number,
): number {
  const safeAspectRatio = Math.max(aspectRatio ?? 1, 0.1);
  const widthPixels =
    (clamp(placement.widthPercent, 0, 100) / 100) *
    Math.max(frameWidth, 1);
  const heightPixels = widthPixels / safeAspectRatio;

  return clamp(
    (heightPixels / Math.max(sectionHeight, 1)) * 100,
    1,
    100,
  );
}

export function resetImageFrameHeight(
  element: ImageElement,
  breakpoint: Breakpoint,
): ImageElement {
  if (breakpoint === 'desktop') {
    const desktop = { ...element.placement.desktop };
    delete desktop.heightPercent;

    return {
      ...element,
      placement: {
        ...element.placement,
        desktop,
      },
    };
  }

  const override = { ...(element.placement[breakpoint] ?? {}) };
  delete override.heightPercent;

  const placement = {
    ...element.placement,
  };

  if (Object.keys(override).length === 0) {
    delete placement[breakpoint];
  } else {
    placement[breakpoint] = override;
  }

  return {
    ...element,
    placement,
  };
}

export function patchImageCropPlacement(
  element: ImageElement,
  breakpoint: Breakpoint,
  patch: Pick<
    Partial<Placement>,
    'imageFit' | 'imageFocalX' | 'imageFocalY' | 'heightPercent'
  >,
): ImageElement {
  return {
    ...element,
    placement: patchPlacement(
      element.placement,
      breakpoint,
      patch,
    ),
  };
}
