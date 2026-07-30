import { describe, expect, it } from 'vitest';
import { removeSection } from '../src/editor/model/documentOps';
import { initialSiteDocument } from '../src/editor/model/initialDocument';

function withTwoSections() {
  const document = structuredClone(initialSiteDocument);
  const page = document.pages[0];
  if (!page) throw new Error('Initial page missing.');
  page.sections = page.sections.slice(0, 2);
  return { document, page };
}

describe('section operations', () => {
  it('removes a section and all of its scene elements', () => {
    const { document, page } = withTwoSections();
    const removedId = page.sections[1]?.id;
    if (!removedId) throw new Error('Second section missing.');

    const result = removeSection(document, page.id, removedId);
    expect(result.pages[0]?.sections).toHaveLength(1);
    expect(result.pages[0]?.sections.some((section) => section.id === removedId)).toBe(false);
  });

  it('refuses to remove the final section on a page', () => {
    const document = structuredClone(initialSiteDocument);
    const page = document.pages[0];
    if (!page) throw new Error('Initial page missing.');
    page.sections = page.sections.slice(0, 1);
    const onlySectionId = page.sections[0]?.id;
    if (!onlySectionId) throw new Error('Section missing.');

    const result = removeSection(document, page.id, onlySectionId);
    expect(result.pages[0]?.sections).toHaveLength(1);
  });
});
