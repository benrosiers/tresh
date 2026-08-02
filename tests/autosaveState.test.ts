import { describe, expect, it } from 'vitest';
import { initialSiteDocument } from '../src/editor/model/initialDocument';
import {
  editorReducer,
  initialState,
} from '../src/editor/state/editorStore';

describe('Tresh autosave state transitions', () => {
  it('keeps a dirty cloud-ready draft eligible for autosave', () => {
    const result = editorReducer(initialState(), {
      type: 'draft/cloud-ready',
      pageId: 'draft-1',
      lockVersion: 2,
      markDirty: true,
    });

    expect(result.dirty).toBe(true);
    expect(result.cloud.status).toBe('saved');
  });

  it('keeps a dirty hydrated cloud draft eligible for autosave', () => {
    const result = editorReducer(initialState(), {
      type: 'draft/hydrate',
      document: structuredClone(initialSiteDocument),
      pageId: 'draft-1',
      lockVersion: 2,
      savedAt: Date.now(),
      markDirty: true,
    });

    expect(result.dirty).toBe(true);
    expect(result.cloud.status).toBe('saved');
  });
});