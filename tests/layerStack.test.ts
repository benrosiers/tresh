import { describe, expect, it } from 'vitest';
import {
  applyLayerOrder,
  dropLayerIds,
  getLayerStack,
  moveLayerIds,
} from '../src/editor/model/layerStack';
import { initialSiteDocument } from '../src/editor/model/initialDocument';
import type {
  PaintElement,
  SceneElement,
} from '../src/editor/model/siteDocument';

function paintElement(
  id: string,
  sectionId: string,
  zIndex: number,
  tabletZIndex?: number,
): PaintElement {
  return {
    id,
    sectionId,
    type: 'paint',
    assetKey: 'coral',
    decorative: true,
    placement: {
      desktop: {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 20,
        rotationDegrees: 0,
        zIndex,
        opacity: 1,
      },
      ...(tabletZIndex === undefined
        ? {}
        : {
            tablet: {
              zIndex: tabletZIndex,
            },
          }),
    },
    visible: true,
    locked: false,
  };
}

describe('layer stack order', () => {
  it('sorts front to back and follows DOM order for z-index ties', () => {
    const scene: SceneElement[] = [
      paintElement('a', 'hero', 2),
      paintElement('b', 'hero', 2),
      paintElement('c', 'hero', 5),
    ];

    const stack = getLayerStack(scene, 'desktop');

    expect(
      stack.map((entry) => entry.element.id),
    ).toEqual(['c', 'b', 'a']);
    expect(stack.map((entry) => entry.rank)).toEqual([
      1,
      2,
      3,
    ]);
    expect(stack.map((entry) => entry.tied)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('uses the effective responsive z-index', () => {
    const scene: SceneElement[] = [
      paintElement('desktop-front', 'hero', 8, 1),
      paintElement('tablet-front', 'hero', 2, 9),
    ];

    expect(
      getLayerStack(scene, 'desktop').map(
        (entry) => entry.element.id,
      ),
    ).toEqual(['desktop-front', 'tablet-front']);

    expect(
      getLayerStack(scene, 'tablet').map(
        (entry) => entry.element.id,
      ),
    ).toEqual(['tablet-front', 'desktop-front']);
  });

  it('moves and drops ids in front-to-back order', () => {
    const ids = ['front', 'middle', 'back'];

    expect(
      moveLayerIds(ids, 'back', 'front'),
    ).toEqual(['back', 'front', 'middle']);

    expect(
      moveLayerIds(ids, 'front', 'backward'),
    ).toEqual(['middle', 'front', 'back']);

    expect(
      dropLayerIds(
        ids,
        'back',
        'front',
        'before',
      ),
    ).toEqual(['back', 'front', 'middle']);
  });

  it('normalizes only the active breakpoint in one document update', () => {
    const document = structuredClone(initialSiteDocument);
    const section = document.pages[0]?.sections[0];

    if (!section) {
      throw new Error('Test section missing.');
    }

    section.scene = [
      paintElement('a', section.id, 7),
      paintElement('b', section.id, 4),
      paintElement('c', section.id, 1),
    ];

    const reordered = applyLayerOrder(
      document,
      section.id,
      'tablet',
      ['c', 'a', 'b'],
    );
    const resultSection =
      reordered.pages[0]?.sections[0];

    if (!resultSection) {
      throw new Error('Result section missing.');
    }

    expect(
      getLayerStack(
        resultSection.scene,
        'tablet',
      ).map((entry) => entry.element.id),
    ).toEqual(['c', 'a', 'b']);

    const desktopZ = new Map(
      resultSection.scene.map((element) => [
        element.id,
        element.placement.desktop.zIndex,
      ]),
    );

    expect(desktopZ).toEqual(
      new Map([
        ['a', 7],
        ['b', 4],
        ['c', 1],
      ]),
    );

    const tabletZ = new Map(
      resultSection.scene.map((element) => [
        element.id,
        element.placement.tablet?.zIndex,
      ]),
    );

    expect(tabletZ).toEqual(
      new Map([
        ['a', 1],
        ['b', 0],
        ['c', 2],
      ]),
    );
  });
});
