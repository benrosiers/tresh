import { describe, expect, it } from 'vitest';
import {
  parseSiteDocument,
  resolveTextTypography,
  type TextElement,
} from '../src/editor/model/siteDocument';

function createTextElement(
  typography?: TextElement['typography'],
): TextElement {
  return {
    id: 'typography-heading',
    sectionId: 'hero',
    type: 'text',
    text: {
      'fr-CA': 'Un titre vivant',
    },
    variant: 'heading',
    ...(typography ? { typography } : {}),
    placement: {
      desktop: {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 60,
        rotationDegrees: 0,
        zIndex: 4,
        opacity: 1,
        fontSize: 48,
      },
    },
    visible: true,
    locked: false,
  };
}

function createDocument(element: TextElement): unknown {
  return {
    schemaVersion: 1,
    siteKit: 'atelierexpression',
    siteKitVersion: '1.1.0',
    pages: [
      {
        id: '8d7ebae2-a337-42d8-b21b-b71bf345a6bf',
        slug: 'home',
        locale: 'fr-CA',
        title: 'Accueil',
        description: '',
        sections: [
          {
            id: 'hero',
            type: 'HeroSection',
            label: 'Hero',
            visible: true,
            height: {
              desktop: 480,
              tablet: 460,
              mobile: 520,
            },
            props: {},
            scene: [element],
          },
        ],
      },
    ],
  };
}

describe('text typography contract', () => {
  it('preserves the canonical heading appearance for legacy text', () => {
    expect(resolveTextTypography(createTextElement())).toEqual({
      color: '#2B2620',
      fontFamily: 'serif',
      fontWeight: 600,
      fontStyle: 'italic',
      textAlign: 'left',
      lineHeight: 1.08,
      letterSpacing: -0.035,
      textTransform: 'none',
    });
  });

  it('merges partial typography over the variant defaults', () => {
    const resolved = resolveTextTypography(
      createTextElement({
        color: '#E98B5F',
        textAlign: 'center',
      }),
    );

    expect(resolved).toMatchObject({
      color: '#E98B5F',
      fontFamily: 'serif',
      fontWeight: 600,
      textAlign: 'center',
      lineHeight: 1.08,
    });
  });

  it('accepts a complete editable typography payload', () => {
    const element = createTextElement({
      color: '#112233',
      fontFamily: 'sans',
      fontWeight: 800,
      fontStyle: 'normal',
      textAlign: 'right',
      lineHeight: 1.65,
      letterSpacing: 0.04,
      textTransform: 'uppercase',
    });

    const parsed = parseSiteDocument(createDocument(element));
    const parsedElement =
      parsed.pages[0]?.sections[0]?.scene[0];

    expect(parsedElement).toMatchObject({
      type: 'text',
      typography: {
        color: '#112233',
        fontFamily: 'sans',
        fontWeight: 800,
        fontStyle: 'normal',
        textAlign: 'right',
        lineHeight: 1.65,
        letterSpacing: 0.04,
        textTransform: 'uppercase',
      },
    });
  });

  it('rejects typography values outside the public contract', () => {
    const invalid = {
      ...createTextElement(),
      typography: {
        color: 'orange',
        fontFamily: 'comic-sans',
        fontWeight: 950,
        lineHeight: 8,
      },
    };

    expect(() =>
      parseSiteDocument(createDocument(invalid as TextElement)),
    ).toThrow();
  });
});
