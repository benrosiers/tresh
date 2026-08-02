import { describe, expect, it } from 'vitest';
import {
  applySelectionPlacementPatches,
  layoutSelection,
  removeSelectionFromDocument,
} from '../src/editor/model/selectionOps';
import { initialSiteDocument } from '../src/editor/model/initialDocument';
import type { SelectionBox } from '../src/editor/model/selectionOps';

const boxes: SelectionBox[] = [
  {
    id: 'a',
    left: 10,
    top: 10,
    right: 30,
    bottom: 30,
    width: 20,
    height: 20,
  },
  {
    id: 'b',
    left: 40,
    top: 20,
    right: 50,
    bottom: 30,
    width: 10,
    height: 10,
  },
  {
    id: 'c',
    left: 70,
    top: 40,
    right: 90,
    bottom: 60,
    width: 20,
    height: 20,
  },
];

describe('Tresh multi-selection layout', () => {
  it('aligns real element edges instead of only their center points', () => {
    expect(layoutSelection(boxes, 'left')).toEqual({
      a: { xPercent: 20 },
      b: { xPercent: 15 },
      c: { xPercent: 20 },
    });

    expect(layoutSelection(boxes, 'bottom')).toEqual({
      a: { yPercent: 50 },
      b: { yPercent: 55 },
      c: { yPercent: 50 },
    });
  });

  it('distributes elements while preserving the outer bounds', () => {
    expect(layoutSelection(boxes, 'distribute-horizontal')).toEqual({
      a: { xPercent: 20 },
      b: { xPercent: 50 },
      c: { xPercent: 80 },
    });
  });

  it('writes placement changes only to the active breakpoint', () => {
    const document = structuredClone(initialSiteDocument);
    const element =
      document.pages[0]?.sections[0]?.scene[0];

    if (!element) {
      throw new Error('Initial element missing.');
    }

    const desktop = structuredClone(
      element.placement.desktop,
    );

    const updated = applySelectionPlacementPatches(
      document,
      'tablet',
      {
        [element.id]: {
          xPercent: 72,
          yPercent: 64,
        },
      },
    );

    const updatedElement =
      updated.pages[0]?.sections[0]?.scene[0];

    expect(updatedElement?.placement.desktop).toEqual(desktop);
    expect(updatedElement?.placement.tablet).toEqual({
      ...element.placement.tablet,
      xPercent: 72,
      yPercent: 64,
    });
  });

  it('does not move or delete locked elements', () => {
    const document = structuredClone(initialSiteDocument);
    const section = document.pages[0]?.sections[0];
    const element = section?.scene[0];

    if (!section || !element) {
      throw new Error('Initial element missing.');
    }

    element.locked = true;
    const originalPlacement = structuredClone(
      element.placement,
    );

    const moved = applySelectionPlacementPatches(
      document,
      'desktop',
      {
        [element.id]: {
          xPercent: 1,
          yPercent: 1,
        },
      },
    );

    expect(
      moved.pages[0]?.sections[0]?.scene[0]?.placement,
    ).toEqual(originalPlacement);

    const removed = removeSelectionFromDocument(
      document,
      [element.id],
    );

    expect(
      removed.pages[0]?.sections[0]?.scene.some(
        (candidate) => candidate.id === element.id,
      ),
    ).toBe(true);
  });
});
