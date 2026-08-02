import { describe, expect, it } from 'vitest';
import {
  focalPointFromClient,
  intrinsicImageFrameHeightPercent,
  resetImageFrameHeight,
  resolveImageCrop,
} from '../src/editor/model/imageCrop';
import {
  parseSiteDocument,
  type ImageElement,
} from '../src/editor/model/siteDocument';

function imageElement(): ImageElement {
  return {
    id: 'image-crop-test',
    sectionId: 'hero',
    type: 'image',
    source: {
      kind: 'url',
      url: 'https://example.com/cindy.webp',
    },
    altText: {
      'fr-CA': 'Image test',
    },
    cornerRadius: 0,
    aspectRatio: 1.5,
    fit: 'contain',
    placement: {
      desktop: {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 40,
        rotationDegrees: 0,
        zIndex: 3,
        opacity: 1,
      },
      tablet: {
        imageFit: 'cover',
        imageFocalX: 72,
        imageFocalY: 28,
        heightPercent: 36,
      },
    },
    visible: true,
    locked: false,
  };
}

describe('Tresh image crop and focal point', () => {
  it('inherits legacy image fit and centered focal point', () => {
    expect(resolveImageCrop(imageElement(), 'desktop')).toEqual({
      fit: 'contain',
      focalX: 50,
      focalY: 50,
      frameHeightPercent: undefined,
    });
  });

  it('resolves active breakpoint crop overrides', () => {
    expect(resolveImageCrop(imageElement(), 'tablet')).toEqual({
      fit: 'cover',
      focalX: 72,
      focalY: 28,
      frameHeightPercent: 36,
    });
  });

  it('maps client coordinates to a clamped focal point', () => {
    expect(
      focalPointFromClient(
        {
          clientX: 500,
          clientY: 250,
        },
        {
          left: 100,
          top: 50,
          width: 800,
          height: 400,
        },
      ),
    ).toEqual({
      x: 50,
      y: 50,
    });

    expect(
      focalPointFromClient(
        {
          clientX: -200,
          clientY: 999,
        },
        {
          left: 100,
          top: 50,
          width: 800,
          height: 400,
        },
      ),
    ).toEqual({
      x: 0,
      y: 100,
    });
  });

  it('calculates the intrinsic frame height from the image ratio', () => {
    expect(
      intrinsicImageFrameHeightPercent(
        {
          widthPercent: 50,
        },
        2,
        1200,
        600,
      ),
    ).toBe(50);
  });

  it('removes only the active breakpoint frame-height override', () => {
    const source = imageElement();
    source.placement.desktop.heightPercent = 42;

    const tabletReset = resetImageFrameHeight(
      source,
      'tablet',
    );

    expect(tabletReset.placement.desktop.heightPercent).toBe(42);
    expect(tabletReset.placement.tablet).toEqual({
      imageFit: 'cover',
      imageFocalX: 72,
      imageFocalY: 28,
    });
  });

  it('accepts fill and responsive focal fields in the site contract', () => {
    const element = imageElement();
    element.placement.desktop = {
      ...element.placement.desktop,
      imageFit: 'fill',
      imageFocalX: 45,
      imageFocalY: 65,
      heightPercent: 32,
    };

    const parsed = parseSiteDocument({
      schemaVersion: 1,
      siteKit: 'test',
      siteKitVersion: '1.0.0',
      pages: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          slug: 'home',
          locale: 'fr-CA',
          sections: [
            {
              id: 'hero',
              type: 'FreeformSection',
              label: 'Hero',
              visible: true,
              height: {
                desktop: 500,
                tablet: 500,
                mobile: 500,
              },
              props: {},
              scene: [element],
            },
          ],
        },
      ],
    });

    expect(
      parsed.pages[0]?.sections[0]?.scene[0],
    ).toMatchObject({
      type: 'image',
      placement: {
        desktop: {
          imageFit: 'fill',
          imageFocalX: 45,
          imageFocalY: 65,
          heightPercent: 32,
        },
      },
    });
  });
});
