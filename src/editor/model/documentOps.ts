import type {
  Breakpoint,
  PageDocument,
  Placement,
  ResponsivePlacement,
  SceneElement,
  SectionDocument,
  SiteDocument,
} from './siteDocument';

export function cloneDocument(document: SiteDocument): SiteDocument {
  return structuredClone(document);
}

export function getPage(document: SiteDocument, pageId: string): PageDocument | undefined {
  return document.pages.find((page) => page.id === pageId);
}

export function findElement(document: SiteDocument, elementId: string): SceneElement | undefined {
  for (const page of document.pages) {
    for (const section of page.sections) {
      const found = section.scene.find((element) => element.id === elementId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findSection(document: SiteDocument, sectionId: string): SectionDocument | undefined {
  for (const page of document.pages) {
    const found = page.sections.find((section) => section.id === sectionId);
    if (found) return found;
  }
  return undefined;
}

export function updateElement(
  document: SiteDocument,
  elementId: string,
  updater: (element: SceneElement) => SceneElement,
): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        scene: section.scene.map((element) =>
          element.id === elementId ? updater(element) : element,
        ),
      })),
    })),
  };
}

export function removeElement(document: SiteDocument, elementId: string): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        scene: section.scene.filter((element) => element.id !== elementId),
      })),
    })),
  };
}

export function removeSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => {
      if (page.id !== pageId || page.sections.length <= 1) return page;
      return {
        ...page,
        sections: page.sections.filter((section) => section.id !== sectionId),
      };
    }),
  };
}

export function updateSection(
  document: SiteDocument,
  sectionId: string,
  updater: (section: SectionDocument) => SectionDocument,
): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId ? updater(section) : section,
      ),
    })),
  };
}

export function moveSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  direction: -1 | 1,
): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => {
      if (page.id !== pageId) return page;
      const index = page.sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= page.sections.length) return page;
      const sections = [...page.sections];
      const current = sections[index];
      const destination = sections[nextIndex];
      if (!current || !destination) return page;
      sections[index] = destination;
      sections[nextIndex] = current;
      return { ...page, sections };
    }),
  };
}

export function addElementToSection(
  document: SiteDocument,
  sectionId: string,
  element: SceneElement,
): SiteDocument {
  return updateSection(document, sectionId, (section) => ({
    ...section,
    scene: [...section.scene, element],
  }));
}

export function resolvePlacement(
  placement: ResponsivePlacement,
  breakpoint: Breakpoint,
): Placement {
  if (breakpoint === 'desktop') return placement.desktop;
  return { ...placement.desktop, ...(placement[breakpoint] ?? {}) };
}

export function patchPlacement(
  placement: ResponsivePlacement,
  breakpoint: Breakpoint,
  patch: Partial<Placement>,
): ResponsivePlacement {
  if (breakpoint === 'desktop') {
    return { ...placement, desktop: { ...placement.desktop, ...patch } };
  }

  return {
    ...placement,
    [breakpoint]: {
      ...(placement[breakpoint] ?? {}),
      ...patch,
    },
  };
}
