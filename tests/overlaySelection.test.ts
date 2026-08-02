import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasBlockingEditorMenuFocus,
  hasBlockingEditorOverlay,
} from '../src/editor/components/editorOverlay';

describe('editor overlay selection suppression', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects blocking editor dialogs', () => {
    expect(hasBlockingEditorOverlay(document)).toBe(false);

    document.body.innerHTML =
      '<div class="modal-backdrop"><section role="dialog" aria-modal="true"></section></div>';

    expect(hasBlockingEditorOverlay(document)).toBe(true);
  });

  it('detects the canvas diagnostic overlay', () => {
    document.body.innerHTML =
      '<aside class="canvas-diagnostics"></aside>';

    expect(hasBlockingEditorOverlay(document)).toBe(true);
  });

  it('detects open aria menus', () => {
    document.body.innerHTML =
      '<button aria-expanded="true" aria-controls="menu">Menu</button>';

    expect(hasBlockingEditorOverlay(document)).toBe(true);
  });

  it('suppresses selection while a topbar site or page select has focus', () => {
    document.body.innerHTML =
      '<header class="topbar"><select><option>Accueil</option></select></header>';

    const select = document.querySelector('select');

    expect(hasBlockingEditorMenuFocus(select)).toBe(true);
    expect(hasBlockingEditorMenuFocus(document.body)).toBe(false);
  });
});
