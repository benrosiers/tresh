import { describe, expect, it } from 'vitest';
import {
  getImageSourceDetails,
  storagePathFromPublicUrl,
} from '../src/editor/model/imageSourceDetails';
import {
  parseSiteDocument,
  type ImageElement,
} from '../src/editor/model/siteDocument';

const image: ImageElement = {
  id: 'image-test',
  sectionId: 'home-hero',
  type: 'image',
  source: {
    kind: 'url',
    url: 'https://example.supabase.co/storage/v1/object/public/site-media/user-1/asset.png',
    fileName: 'portrait-cindy.png',
    storagePath: 'user-1/asset.png',
    mimeType: 'image/png',
  },
  altText: {
    'fr-CA': 'Portrait',
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
      zIndex: 1,
      opacity: 1,
    },
  },
  visible: true,
  locked: false,
};

describe('Tresh image source persistence', () => {
  it('keeps uploaded file metadata in the site contract', () => {
    const parsed = parseSiteDocument({
      schemaVersion: 1,
      siteKit: 'atelierexpression',
      siteKitVersion: '1.0.0',
      pages: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          slug: 'home',
          locale: 'fr-CA',
          sections: [
            {
              id: 'home-hero',
              type: 'HeroSection',
              label: 'Hero',
              visible: true,
              height: {
                desktop: 480,
                tablet: 460,
                mobile: 520,
              },
              props: {},
              scene: [image],
            },
          ],
        },
      ],
    });

    const parsedImage = parsed.pages[0]?.sections[0]?.scene[0];

    expect(parsedImage).toMatchObject({
      type: 'image',
      source: {
        kind: 'url',
        fileName: 'portrait-cindy.png',
        storagePath: 'user-1/asset.png',
        mimeType: 'image/png',
      },
    });
  });

  it('returns thumbnail, original name, path, and copy value', () => {
    expect(getImageSourceDetails(image)).toMatchObject({
      previewUrl: image.source.kind === 'url'
        ? image.source.url
        : null,
      fileName: 'portrait-cindy.png',
      storagePath: 'user-1/asset.png',
      copyValue: 'user-1/asset.png',
      sourceLabel: 'Stockage Supabase',
    });
  });

  it('derives the storage path from an older public URL', () => {
    expect(
      storagePathFromPublicUrl(
        'https://example.supabase.co/storage/v1/object/public/site-media/user-2/old%20asset.webp',
      ),
    ).toBe('user-2/old asset.webp');
  });
});
