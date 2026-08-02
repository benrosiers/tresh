import { describe, expect, it } from 'vitest';
import {
  getDefaultViewportPresetId,
  getViewportPreset,
  isViewportPresetId,
  VIEWPORT_PRESETS,
} from '../src/editor/model/viewportMode';

describe('Tresh viewport presets', () => {
  it('defines the requested screen ratios and CSS dimensions', () => {
    expect(
      VIEWPORT_PRESETS.map(
        ({ id, width, height, breakpoint }) => ({
          id,
          width,
          height,
          breakpoint,
        }),
      ),
    ).toEqual([
      {
        id: 'desktop-16-9',
        width: 1440,
        height: 810,
        breakpoint: 'desktop',
      },
      {
        id: 'laptop-16-10',
        width: 1280,
        height: 800,
        breakpoint: 'desktop',
      },
      {
        id: 'tablet-4-3',
        width: 768,
        height: 576,
        breakpoint: 'tablet',
      },
      {
        id: 'mobile-9-16',
        width: 390,
        height: 693,
        breakpoint: 'mobile',
      },
    ]);

    expect(1440 / 810).toBeCloseTo(16 / 9, 6);
    expect(1280 / 800).toBeCloseTo(16 / 10, 6);
    expect(768 / 576).toBeCloseTo(4 / 3, 6);
    expect(390 / 693).toBeCloseTo(9 / 16, 3);
  });

  it('maps each responsive breakpoint to a useful default screen', () => {
    expect(getDefaultViewportPresetId('desktop')).toBe(
      'desktop-16-9',
    );
    expect(getDefaultViewportPresetId('tablet')).toBe(
      'tablet-4-3',
    );
    expect(getDefaultViewportPresetId('mobile')).toBe(
      'mobile-9-16',
    );
  });

  it('validates stored preset IDs and resolves presets safely', () => {
    expect(isViewportPresetId('laptop-16-10')).toBe(true);
    expect(isViewportPresetId('unknown')).toBe(false);
    expect(isViewportPresetId(null)).toBe(false);

    expect(getViewportPreset('mobile-9-16')).toMatchObject({
      width: 390,
      height: 693,
      breakpoint: 'mobile',
    });
  });
});
