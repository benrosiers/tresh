import {
  patchPlacement,
  resolvePlacement,
  updateSection,
} from './documentOps';
import type {
  Breakpoint,
  SceneElement,
  SiteDocument,
} from './siteDocument';

export type LayerMove =
  | 'front'
  | 'forward'
  | 'backward'
  | 'back';

export type LayerDropPosition = 'before' | 'after';

export interface LayerStackEntry {
  element: SceneElement;
  zIndex: number;
  sourceIndex: number;
  rank: number;
  tied: boolean;
}

export function getLayerStack(
  scene: SceneElement[],
  breakpoint: Breakpoint,
): LayerStackEntry[] {
  const entries = scene.map((element, sourceIndex) => ({
    element,
    sourceIndex,
    zIndex: resolvePlacement(
      element.placement,
      breakpoint,
    ).zIndex,
  }));

  const counts = new Map<number, number>();

  for (const entry of entries) {
    counts.set(
      entry.zIndex,
      (counts.get(entry.zIndex) ?? 0) + 1,
    );
  }

  return entries
    .sort(
      (left, right) =>
        right.zIndex - left.zIndex ||
        right.sourceIndex - left.sourceIndex,
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      tied: (counts.get(entry.zIndex) ?? 0) > 1,
    }));
}

export function moveLayerIds(
  orderedIds: string[],
  elementId: string,
  move: LayerMove,
): string[] {
  const index = orderedIds.indexOf(elementId);

  if (index < 0 || orderedIds.length < 2) {
    return [...orderedIds];
  }

  let destination = index;

  switch (move) {
    case 'front':
      destination = 0;
      break;
    case 'forward':
      destination = Math.max(0, index - 1);
      break;
    case 'backward':
      destination = Math.min(
        orderedIds.length - 1,
        index + 1,
      );
      break;
    case 'back':
      destination = orderedIds.length - 1;
      break;
  }

  if (destination === index) return [...orderedIds];

  const next = [...orderedIds];
  const [moved] = next.splice(index, 1);

  if (!moved) return [...orderedIds];

  next.splice(destination, 0, moved);
  return next;
}

export function dropLayerIds(
  orderedIds: string[],
  draggedId: string,
  targetId: string,
  position: LayerDropPosition,
): string[] {
  if (
    draggedId === targetId ||
    !orderedIds.includes(draggedId) ||
    !orderedIds.includes(targetId)
  ) {
    return [...orderedIds];
  }

  const next = orderedIds.filter(
    (elementId) => elementId !== draggedId,
  );
  const targetIndex = next.indexOf(targetId);

  if (targetIndex < 0) return [...orderedIds];

  next.splice(
    position === 'before'
      ? targetIndex
      : targetIndex + 1,
    0,
    draggedId,
  );

  return next;
}

export function applyLayerOrder(
  document: SiteDocument,
  sectionId: string,
  breakpoint: Breakpoint,
  requestedOrder: string[],
): SiteDocument {
  return updateSection(
    document,
    sectionId,
    (section) => {
      const currentOrder = getLayerStack(
        section.scene,
        breakpoint,
      ).map((entry) => entry.element.id);
      const available = new Set(currentOrder);
      const seen = new Set<string>();
      const orderedIds: string[] = [];

      for (const elementId of [
        ...requestedOrder,
        ...currentOrder,
      ]) {
        if (
          !available.has(elementId) ||
          seen.has(elementId)
        ) {
          continue;
        }

        seen.add(elementId);
        orderedIds.push(elementId);
      }

      if (orderedIds.length > 101) {
        return section;
      }

      const zIndexById = new Map(
        orderedIds.map((elementId, index) => [
          elementId,
          orderedIds.length - index - 1,
        ]),
      );

      return {
        ...section,
        scene: section.scene.map((element) => {
          const zIndex = zIndexById.get(element.id);

          return zIndex === undefined
            ? element
            : {
                ...element,
                placement: patchPlacement(
                  element.placement,
                  breakpoint,
                  { zIndex },
                ),
              };
        }),
      };
    },
  );
}
