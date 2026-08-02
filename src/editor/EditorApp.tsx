import { useEffect } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { Filmstrip } from './components/Filmstrip';
import { Inspector } from './components/Inspector';
import { LeftRail } from './components/LeftRail';
import { PublishNotice } from './components/PublishNotice';
import { PreviewButtonPortal } from './components/PreviewButtonPortal';
import { Topbar } from './components/Topbar';
import { SiteWorkspaceProvider } from '../sites';
import { EditorProvider, useEditor } from './state/editorStore';
import './editor.css';

function EditorKeyboardShortcuts() {
  const { state, dispatch } = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, [contenteditable="true"]');
      if (editing) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'd' &&
        state.selectedIds.length > 0
      ) {
        event.preventDefault();
        dispatch({ type: 'selection/duplicate' });
        return;
      }

      if (
        (event.key === 'Delete' ||
          event.key === 'Backspace') &&
        state.selectedIds.length > 0
      ) {
        event.preventDefault();

        const count = state.selectedIds.length;
        const message =
          count === 1
            ? 'Supprimer l’élément sélectionné?'
            : `Supprimer les ${count} éléments sélectionnés?`;

        if (window.confirm(message)) {
          dispatch({ type: 'selection/remove' });
        }

        return;
      }

      if (
        event.key === 'Escape' &&
        state.selectedIds.length > 0
      ) {
        event.preventDefault();
        dispatch({ type: 'selection/clear' });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'history/redo' : 'history/undo' });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        dispatch({ type: 'history/redo' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state.selectedIds]);

  return null;
}

function EditorShell() {
  return (
    <div className="editor-app">
      <Topbar />
      <div className="editor-main">
        <LeftRail />
        <CanvasStage />
        <Inspector />
      </div>
      <Filmstrip />
      <PublishNotice />
      <PreviewButtonPortal />
      <EditorKeyboardShortcuts />
    </div>
  );
}

export function EditorApp() {
  return (
    <SiteWorkspaceProvider>
      <EditorProvider>
        <EditorShell />
      </EditorProvider>
    </SiteWorkspaceProvider>
  );
}
