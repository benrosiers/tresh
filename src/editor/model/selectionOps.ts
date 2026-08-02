import {
  patchPlacement,
  resolvePlacement,
} from './documentOps';
import { duplicateElementInDocument } from './duplication';
import type {
  Breakpoint,
  Placement,
  SceneElement,
  SiteDocument,
} from './siteDocument';

export type SelectionLayoutCommand =
  | 'left'
  | 'center-horizontal'
  | 'right'
  | 'top'
  | 'center-vertical'
  | 'bottom'
  | 'distribute-horizontal'
  | 'distribute-vertical';

export interface SelectionBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type SelectionPlacementPatches = Record<
  string,
  Partial<Pick<Placement, 'xPercent' | 'yPercent'>>
>;

export interface DuplicateSelectionResult {
  document: SiteDocument;
  elementIds: string[];
  sectionId: string;
}

function uniqueIds(elementIds: string[]): string[] {
  return [...new Set(elementIds)];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function layoutSelection(
  boxes: SelectionBox[],
  command: SelectionLayoutCommand,
): SelectionPlacementPatches {
  if (boxes.length < 2) return {};

  const patches: SelectionPlacementPatches = {};

  if (command === 'left') {
    const edge = Math.min(...boxes.map((box) => box.left));

    for (const box of boxes) {
      patches[box.id] = {
        xPercent: clampPercent(edge + box.width / 2),
      };
    }

    return patches;
  }

  if (command === 'center-horizontal') {
    const left = Math.min(...boxes.map((box) => box.left));
    const right = Math.max(...boxes.map((box) => box.right));
    const center = (left + right) / 2;

    for (const box of boxes) {
      patches[box.id] = {
        xPercent: clampPercent(center),
      };
    }

    return patches;
  }

  if (command === 'right') {
    const edge = Math.max(...boxes.map((box) => box.right));

    for (const box of boxes) {
      patches[box.id] = {
        xPercent: clampPercent(edge - box.width / 2),
      };
    }

    return patches;
  }

  if (command === 'top') {
    const edge = Math.min(...boxes.map((box) => box.top));

    for (const box of boxes) {
      patches[box.id] = {
        yPercent: clampPercent(edge + box.height / 2),
      };
    }

    return patches;
  }

  if (command === 'center-vertical') {
    const top = Math.min(...boxes.map((box) => box.top));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const center = (top + bottom) / 2;

    for (const box of boxes) {
      patches[box.id] = {
        yPercent: clampPercent(center),
      };
    }

    return patches;
  }

  if (command === 'bottom') {
    const edge = Math.max(...boxes.map((box) => box.bottom));

    for (const box of boxes) {
      patches[box.id] = {
        yPercent: clampPercent(edge - box.height / 2),
      };
    }

    return patches;
  }

  if (command === 'distribute-horizontal') {
    const ordered = [...boxes].sort(
      (leftBox, rightBox) => leftBox.left - rightBox.left,
    );
    const first = ordered[0];
    const last = ordered.at(-1);

    if (!first || !last) return {};

    const occupiedWidth = ordered.reduce(
      (total, box) => total + box.width,
      0,
    );
    const availableWidth = last.right - first.left;
    const gap =
      (availableWidth - occupiedWidth) /
      Math.max(1, ordered.length - 1);

    let cursor = first.left;

    for (const box of ordered) {
      patches[box.id] = {
        xPercent: clampPercent(cursor + box.width / 2),
      };
      cursor += box.width + gap;
    }

    return patches;
  }

  const ordered = [...boxes].sort(
    (topBox, bottomBox) => topBox.top - bottomBox.top,
  );
  const first = ordered[0];
  const last = ordered.at(-1);

  if (!first || !last) return {};

  const occupiedHeight = ordered.reduce(
    (total, box) => total + box.height,
    0,
  );
  const availableHeight = last.bottom - first.top;
  const gap =
    (availableHeight - occupiedHeight) /
    Math.max(1, ordered.length - 1);

  let cursor = first.top;

  for (const box of ordered) {
    patches[box.id] = {
      yPercent: clampPercent(cursor + box.height / 2),
    };
    cursor += box.height + gap;
  }

  return patches;
}

export function applySelectionPlacementPatches(
  document: SiteDocument,
  breakpoint: Breakpoint,
  patches: SelectionPlacementPatches,
): SiteDocument {
  const patchEntries = Object.entries(patches);
  if (patchEntries.length === 0) return document;

  const patchMap = new Map(patchEntries);

  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        scene: section.scene.map((element) => {
          const patch = patchMap.get(element.id);
          if (!patch || element.locked) return element;

          return {
            ...element,
            placement: patchPlacement(
              element.placement,
              breakpoint,
              patch,
            ),
          };
        }),
      })),
    })),
  };
}

export function removeSelectionFromDocument(
  document: SiteDocument,
  elementIds: string[],
): SiteDocument {
  const ids = new Set(uniqueIds(elementIds));
  if (ids.size === 0) return document;

  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        scene: section.scene.filter(
          (element) => !ids.has(element.id) || element.locked,
        ),
      })),
    })),
  };
}

export function duplicateSelectionInDocument(
  document: SiteDocument,
  elementIds: string[],
): DuplicateSelectionResult | null {
  let nextDocument = document;
  const duplicatedIds: string[] = [];
  let sectionId = '';

  for (const elementId of uniqueIds(elementIds)) {
    const source = findElementById(nextDocument, elementId);
    if (!source || source.locked) continue;

    const result = duplicateElementInDocument(
      nextDocument,
      elementId,
    );

    if (!result) continue;

    nextDocument = result.document;
    duplicatedIds.push(result.element.id);
    sectionId = result.element.sectionId;
  }

  if (duplicatedIds.length === 0 || !sectionId) return null;

  return {
    document: nextDocument,
    elementIds: duplicatedIds,
    sectionId,
  };
}

export function translateSelectionPatches(
  elements: SceneElement[],
  breakpoint: Breakpoint,
  deltaXPercent: number,
  deltaYPercent: number,
): SelectionPlacementPatches {
  const patches: SelectionPlacementPatches = {};

  for (const element of elements) {
    if (element.locked) continue;

    const placement = resolvePlacement(
      element.placement,
      breakpoint,
    );

    patches[element.id] = {
      xPercent: clampPercent(
        placement.xPercent + deltaXPercent,
      ),
      yPercent: clampPercent(
        placement.yPercent + deltaYPercent,
      ),
    };
  }

  return patches;
}

function findElementById(
  document: SiteDocument,
  elementId: string,
): SceneElement | undefined {
  for (const page of document.pages) {
    for (const section of page.sections) {
      const element = section.scene.find(
        (candidate) => candidate.id === elementId,
      );

      if (element) return element;
    }
  }

  return undefined;
}
