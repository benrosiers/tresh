import { describe, expect, it } from 'vitest';
import {
  duplicateElementInDocument,
  duplicateSectionInDocument,
  type DuplicateIdFactory,
} from '../src/editor/model/duplication';
import { initialSiteDocument } from '../src/editor/model/initialDocument';

function idFactory(values: string[]): DuplicateIdFactory {
  let index = 0;

  return () => {
    const value = values[index];
    index += 1;

    if (!value) {
      throw new Error('The deterministic test ID factory was exhausted.');
    }

    return value;
  };
}

describe('Tresh element and section duplication', () => {
  it('duplicates an element immediately after its source with a visible offset', () => {
    const document = structuredClone(initialSiteDocument);
    const page = document.pages[0];
    const section = page?.sections[0];
    const source = section?.scene[0];

    if (!page || !section || !source) {
      throw new Error('Initial element missing.');
    }

    source.placement.tablet = {
      xPercent: 94,
      yPercent: 97,
    };
    source.placement.mobile = {
      widthPercent: 66,
    };

    const original = structuredClone(source);
    const result = duplicateElementInDocument(
      document,
      source.id,
      idFactory(['copy01']),
    );

    expect(result).not.toBeNull();
    if (!result) return;

    const sourceIndex = section.scene.findIndex(
      (element) => element.id === source.id,
    );
    const duplicatedScene =
      result.document.pages[0]?.sections[0]?.scene;
    const duplicate = duplicatedScene?.[sourceIndex + 1];

    expect(document.pages[0]?.sections[0]?.scene[sourceIndex]).toEqual(
      original,
    );
    expect(duplicate).toEqual(result.element);
    expect(duplicate?.id).toBe(`${source.type}-copy01`);
    expect(duplicate?.sectionId).toBe(section.id);
    expect(duplicate?.placement.desktop.xPercent).toBe(
      Math.min(100, original.placement.desktop.xPercent + 2),
    );
    expect(duplicate?.placement.desktop.yPercent).toBe(
      Math.min(100, original.placement.desktop.yPercent + 2),
    );
    expect(duplicate?.placement.tablet).toEqual({
      xPercent: 96,
      yPercent: 99,
    });
    expect(duplicate?.placement.mobile).toEqual({
      widthPercent: 66,
    });
  });

  it('duplicates a complete section with fresh IDs and unchanged content', () => {
    const document = structuredClone(initialSiteDocument);
    const page = document.pages[0];
    const source = page?.sections[0];

    if (!page || !source) {
      throw new Error('Initial section missing.');
    }

    const sourceSnapshot = structuredClone(source);
    const values = [
      'section01',
      ...source.scene.map((_, index) => `element${index + 1}`),
    ];

    const result = duplicateSectionInDocument(
      document,
      page.id,
      source.id,
      idFactory(values),
    );

    expect(result).not.toBeNull();
    if (!result) return;

    const sourceIndex = page.sections.findIndex(
      (section) => section.id === source.id,
    );
    const duplicate =
      result.document.pages[0]?.sections[sourceIndex + 1];

    expect(document.pages[0]?.sections[sourceIndex]).toEqual(
      sourceSnapshot,
    );
    expect(duplicate).toEqual(result.section);
    expect(duplicate?.id).toBe('section-section01');
    expect(duplicate?.label).toBe(`${source.label} — copie`);
    expect(duplicate?.scene).toHaveLength(source.scene.length);

    duplicate?.scene.forEach((element, index) => {
      const sourceElement = source.scene[index];

      expect(sourceElement).toBeDefined();
      expect(element.id).not.toBe(sourceElement?.id);
      expect(element.sectionId).toBe(duplicate.id);
      expect(element.placement).toEqual(sourceElement?.placement);
    });
  });

  it('returns null when the requested source does not exist', () => {
    const document = structuredClone(initialSiteDocument);

    expect(
      duplicateElementInDocument(document, 'missing-element'),
    ).toBeNull();
    expect(
      duplicateSectionInDocument(
        document,
        document.pages[0]?.id ?? 'missing-page',
        'missing-section',
      ),
    ).toBeNull();
  });
});
