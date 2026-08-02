import { describe, expect, it } from 'vitest';
import {
  getDefaultButtonStyle,
  resolveButtonStyle,
  sceneElementSchema,
} from '../src/editor/model/siteDocument';
import type {
  ButtonElement,
  ButtonStyle,
} from '../src/editor/model/siteDocument';

function makeButton(
  style?: Partial<ButtonStyle>,
): ButtonElement {
  return {
    id: 'button-test',
    sectionId: 'section-test',
    type: 'button',
    label: { 'fr-CA': 'Réserver' },
    href: '/reserver',
    variant: 'primary',
    ...(style ? { style } : {}),
    placement: {
      desktop: {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 24,
        rotationDegrees: 0,
        zIndex: 2,
        opacity: 1,
      },
    },
    visible: true,
    locked: false,
  };
}

describe('button styles', () => {
  it('returns independent canonical defaults for each visual mode', () => {
    const primary = getDefaultButtonStyle('primary');
    const outline = getDefaultButtonStyle('secondary');
    const transparent = getDefaultButtonStyle('text');

    expect(primary.backgroundColor).toBe('#FF4E38');
    expect(primary.borderWidth).toBe(0);
    expect(outline.borderWidth).toBe(1);
    expect(transparent.borderRadius).toBe(0);

    primary.backgroundColor = '#000000';
    expect(getDefaultButtonStyle('primary').backgroundColor).toBe('#FF4E38');
  });

  it('merges partial per-button overrides over variant defaults', () => {
    const resolved = resolveButtonStyle(
      makeButton({
        textColor: '#FFFFFF',
        borderRadius: 18,
        fontSize: 22,
      }),
    );

    expect(resolved).toMatchObject({
      backgroundColor: '#FF4E38',
      textColor: '#FFFFFF',
      borderRadius: 18,
      fontSize: 22,
      fontWeight: 700,
    });
  });

  it('parses style overrides and safe new-tab metadata', () => {
    const parsed = sceneElementSchema.parse({
      ...makeButton({
        backgroundColor: '#123456',
        hoverBackgroundColor: '#654321',
      }),
      openInNewTab: true,
    });

    expect(parsed).toMatchObject({
      type: 'button',
      openInNewTab: true,
      style: {
        backgroundColor: '#123456',
        hoverBackgroundColor: '#654321',
      },
    });
  });

  it('rejects malformed button colors', () => {
    expect(() =>
      sceneElementSchema.parse({
        ...makeButton(),
        style: {
          textColor: 'tomato',
        },
      }),
    ).toThrow();
  });
});
