import type { Breakpoint } from './siteDocument';

export type CanvasViewMode = 'page' | 'viewport';

export type ViewportPresetId =
  | 'desktop-16-9'
  | 'laptop-16-10'
  | 'tablet-4-3'
  | 'mobile-9-16';

export interface ViewportPreset {
  id: ViewportPresetId;
  label: string;
  width: number;
  height: number;
  breakpoint: Breakpoint;
}

const DESKTOP_VIEWPORT_PRESET: ViewportPreset = {
  id: 'desktop-16-9',
  label: 'Bureau 16:9',
  width: 1440,
  height: 810,
  breakpoint: 'desktop',
};

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  DESKTOP_VIEWPORT_PRESET,
  {
    id: 'laptop-16-10',
    label: 'Portable 16:10',
    width: 1280,
    height: 800,
    breakpoint: 'desktop',
  },
  {
    id: 'tablet-4-3',
    label: 'Tablette 4:3',
    width: 768,
    height: 576,
    breakpoint: 'tablet',
  },
  {
    id: 'mobile-9-16',
    label: 'Mobile 9:16',
    width: 390,
    height: 693,
    breakpoint: 'mobile',
  },
];

const DEFAULT_PRESET_BY_BREAKPOINT: Record<
  Breakpoint,
  ViewportPresetId
> = {
  desktop: 'desktop-16-9',
  tablet: 'tablet-4-3',
  mobile: 'mobile-9-16',
};

export function isViewportPresetId(
  value: string | null,
): value is ViewportPresetId {
  return VIEWPORT_PRESETS.some(
    (preset) => preset.id === value,
  );
}

export function getViewportPreset(
  id: ViewportPresetId,
): ViewportPreset {
  return (
    VIEWPORT_PRESETS.find((preset) => preset.id === id) ??
    DESKTOP_VIEWPORT_PRESET
  );
}

export function getDefaultViewportPresetId(
  breakpoint: Breakpoint,
): ViewportPresetId {
  return DEFAULT_PRESET_BY_BREAKPOINT[breakpoint];
}
