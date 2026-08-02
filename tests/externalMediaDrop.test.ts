import { describe, expect, it } from 'vitest';
import {
  externalMediaFingerprint,
  hasExternalFileTransfer,
  isSupportedExternalMediaType,
  selectExternalMediaFile,
} from '../src/editor/model/externalMediaDrop';

interface TestFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

function file(
  name: string,
  type: string,
  size = 1024,
): TestFile {
  return {
    name,
    type,
    size,
    lastModified: 123456,
  };
}

describe('Tresh external media drop', () => {
  it('detects native file transfers', () => {
    expect(hasExternalFileTransfer(['Files'])).toBe(true);
    expect(hasExternalFileTransfer(['text/plain'])).toBe(false);
  });

  it('accepts one PNG, JPEG, or WebP image', () => {
    for (const type of [
      'image/png',
      'image/jpeg',
      'image/webp',
    ]) {
      const candidate = file('atelier-image', type);
      const result = selectExternalMediaFile([candidate]);

      expect(result.error).toBeNull();
      expect(result.file).toBe(candidate);
      expect(isSupportedExternalMediaType(type)).toBe(true);
    }
  });

  it('rejects missing, multiple, and unsupported files', () => {
    expect(selectExternalMediaFile([])).toMatchObject({
      file: null,
      error: 'Aucun fichier image n’a été reçu.',
    });

    expect(
      selectExternalMediaFile([
        file('one.png', 'image/png'),
        file('two.webp', 'image/webp'),
      ]),
    ).toMatchObject({
      file: null,
      error: 'Dépose une seule image à la fois.',
    });

    expect(
      selectExternalMediaFile([
        file('notes.txt', 'text/plain'),
      ]),
    ).toMatchObject({
      file: null,
      error: 'Utilise une image PNG, JPEG ou WebP.',
    });
  });

  it('creates a stable duplicate-prevention fingerprint', () => {
    const candidate = file(
      'cindy.webp',
      'image/webp',
      4096,
    );

    expect(externalMediaFingerprint(candidate)).toBe(
      'cindy.webp:image/webp:4096:123456',
    );
    expect(externalMediaFingerprint(candidate)).toBe(
      externalMediaFingerprint({ ...candidate }),
    );
  });
});
