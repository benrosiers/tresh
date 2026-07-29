import { useEffect } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { Filmstrip } from './components/Filmstrip';
import { Inspector } from './components/Inspector';
import { LeftRail } from './components/LeftRail';
import { PublishNotice } from './components/PublishNotice';
import { Topbar } from './components/Topbar';
import { EditorProvider, useEditor } from './state/editorStore';
import './editor.css';

function EditorKeyboardShortcuts() {
  const { dispatch } = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, [contenteditable="true"]');
      if (editing) return;

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
  }, [dispatch]);

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
      <EditorKeyboardShortcuts />
    </div>
  );
}

export function EditorApp() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  );
}
