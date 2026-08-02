import { describe, expect, it } from 'vitest';
import {
  hasPaletteToolTransfer,
  isPaletteToolId,
  PALETTE_TOOL_MIME,
  placePaletteElementAtPoint,
} from '../src/editor/model/paletteDragDrop';
import type { SceneElement } from '../src/editor/model/siteDocument';

function heading(): SceneElement {
  return {
    id: 'heading-test',
    sectionId: 'section-test',
    type: 'text',
    text: { 'fr-CA': 'Nouveau titre' },
    variant: 'heading',
    placement: {
      desktop: {
        xPercent: 46,
        yPercent: 46,
        widthPercent: 40,
        rotationDegrees: 0,
        zIndex: 5,
        opacity: 1,
        fontSize: 34,
        parallaxDepth: 0,
      },
    },
    visible: true,
    locked: false,
  };
}

describe('Tresh palette drag and drop', () => {
  it('accepts only element tools that can be dropped on the canvas', () => {
    expect(isPaletteToolId('heading')).toBe(true);
    expect(isPaletteToolId('shape')).toBe(true);
    expect(isPaletteToolId('media')).toBe(false);
    expect(isPaletteToolId('section')).toBe(false);
    expect(isPaletteToolId(null)).toBe(false);
    expect(
      hasPaletteToolTransfer([
        'text/plain',
        PALETTE_TOOL_MIME,
      ]),
    ).toBe(true);
  });

  it('places a desktop element under the pointer', () => {
    const placed = placePaletteElementAtPoint(
      heading(),
      'desktop',
      {
        clientX: 600,
        clientY: 350,
      },
      {
        left: 100,
        top: 100,
        width: 1000,
        height: 500,
      },
    );

    expect(placed.placement.desktop.xPercent).toBe(50);
    expect(placed.placement.desktop.yPercent).toBe(50);
  });

  it('writes tablet coordinates only to the tablet override', () => {
    const source = heading();
    const placed = placePaletteElementAtPoint(
      source,
      'tablet',
      {
        clientX: 760,
        clientY: 520,
      },
      {
        left: 100,
        top: 100,
        width: 800,
        height: 600,
      },
    );

    expect(placed.placement.desktop).toEqual(
      source.placement.desktop,
    );
    expect(placed.placement.tablet?.xPercent).toBe(80);
    expect(placed.placement.tablet?.yPercent).toBe(70);
  });

  it('keeps the full element inside section bounds', () => {
    const placed = placePaletteElementAtPoint(
      heading(),
      'desktop',
      {
        clientX: 0,
        clientY: 0,
      },
      {
        left: 100,
        top: 100,
        width: 1000,
        height: 500,
      },
    );

    expect(placed.placement.desktop.xPercent).toBe(20);
    expect(placed.placement.desktop.yPercent).toBeGreaterThan(0);
  });
});
