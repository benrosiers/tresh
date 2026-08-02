const BLOCKING_OVERLAY_SELECTORS = [
  '.modal-backdrop',
  '[role="dialog"][aria-modal="true"]',
  '.canvas-diagnostics',
  '[popover]:not([hidden])',
  '[aria-expanded="true"][aria-controls]',
] as const;

const BLOCKING_MENU_FOCUS_SELECTOR = [
  '.topbar select',
  '.topbar [aria-haspopup="menu"]',
  '.topbar [aria-haspopup="listbox"]',
].join(', ');

export function hasBlockingEditorOverlay(
  root: ParentNode,
): boolean {
  return BLOCKING_OVERLAY_SELECTORS.some((selector) => {
    try {
      return root.querySelector(selector) !== null;
    } catch {
      return false;
    }
  });
}

export function hasBlockingEditorMenuFocus(
  target: Element | null,
): boolean {
  return target?.closest(BLOCKING_MENU_FOCUS_SELECTOR) !== null;
}
