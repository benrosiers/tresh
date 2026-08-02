import {
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type {
  Breakpoint,
  Placement,
  SceneElement,
} from '../model/siteDocument';

interface CanvasDiagnosticsProps {
  open: boolean;
  onClose: () => void;
  zoomPercent: number;
  fitMode: boolean;
  scale: number;
  frameWidth: number;
  totalHeight: number;
  breakpoint: Breakpoint;
  viewportRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  target: HTMLElement | null;
  selectedElement: SceneElement | undefined;
  selectedPlacement: Placement | undefined;
}

interface DiagnosticSample {
  at: number;
  pointerX: number | null;
  pointerY: number | null;
  viewportScrollLeft: number;
  viewportScrollTop: number;
  frameLeft: number | null;
  frameTop: number | null;
  frameWidth: number | null;
  sectionLeft: number | null;
  sectionTop: number | null;
  sectionWidth: number | null;
  sectionHeight: number | null;
  targetLeft: number | null;
  targetTop: number | null;
  targetWidth: number | null;
  targetHeight: number | null;
  expectedCenterX: number | null;
  expectedCenterY: number | null;
  actualCenterX: number | null;
  actualCenterY: number | null;
  centerDeltaX: number | null;
  centerDeltaY: number | null;
  expectedWidth: number | null;
  widthDelta: number | null;
  frameTransform: string;
  frameZoom: string;
  targetTransform: string;
  targetFilter: string;
  devicePixelRatio: number;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function format(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${round(value)}${suffix}`;
}

function geometryStatus(sample: DiagnosticSample | null): {
  label: string;
  className: string;
} {
  if (
    !sample ||
    sample.centerDeltaX === null ||
    sample.centerDeltaY === null
  ) {
    return {
      label: 'Aucune cible sélectionnée',
      className: 'is-neutral',
    };
  }

  const delta = Math.max(
    Math.abs(sample.centerDeltaX),
    Math.abs(sample.centerDeltaY),
  );

  if (delta <= 1) {
    return {
      label: 'Géométrie alignée',
      className: 'is-good',
    };
  }

  if (delta <= 4) {
    return {
      label: 'Décalage mesurable',
      className: 'is-warning',
    };
  }

  return {
    label: 'Système de coordonnées désaligné',
    className: 'is-bad',
  };
}

export function CanvasDiagnostics({
  open,
  onClose,
  zoomPercent,
  fitMode,
  scale,
  frameWidth,
  totalHeight,
  breakpoint,
  viewportRef,
  frameRef,
  target,
  selectedElement,
  selectedPlacement,
}: CanvasDiagnosticsProps) {
  const [pointer, setPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [sample, setSample] = useState<DiagnosticSample | null>(null);
  const [history, setHistory] = useState<DiagnosticSample[]>([]);
  const [disableEffects, setDisableEffects] = useState(false);
  const [hideMoveable, setHideMoveable] = useState(false);
  const [copyState, setCopyState] = useState('Copier le rapport');

  useEffect(() => {
    if (!open) return;

    const handlePointerMove = (event: PointerEvent) => {
      setPointer({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [open]);

  useEffect(() => {
    document.body.classList.toggle(
      'tresh-debug-no-effects',
      open && disableEffects,
    );

    return () => {
      document.body.classList.remove('tresh-debug-no-effects');
    };
  }, [disableEffects, open]);

  useEffect(() => {
    document.body.classList.toggle(
      'tresh-debug-hide-moveable',
      open && hideMoveable,
    );

    return () => {
      document.body.classList.remove('tresh-debug-hide-moveable');
    };
  }, [hideMoveable, open]);

  useEffect(() => {
    if (!open) return;

    const capture = () => {
      const viewport = viewportRef.current;
      const frame = frameRef.current;
      const section = target?.closest<HTMLElement>('[data-section-id]') ?? null;

      const frameRect = frame?.getBoundingClientRect() ?? null;
      const sectionRect = section?.getBoundingClientRect() ?? null;
      const targetRect = target?.getBoundingClientRect() ?? null;

      const frameStyle = frame ? window.getComputedStyle(frame) : null;
      const targetStyle = target ? window.getComputedStyle(target) : null;

      const expectedCenterX =
        sectionRect && selectedPlacement
          ? sectionRect.left +
            (selectedPlacement.xPercent / 100) * sectionRect.width
          : null;

      const expectedCenterY =
        sectionRect && selectedPlacement
          ? sectionRect.top +
            (selectedPlacement.yPercent / 100) * sectionRect.height
          : null;

      const actualCenterX = targetRect
        ? targetRect.left + targetRect.width / 2
        : null;

      const actualCenterY = targetRect
        ? targetRect.top + targetRect.height / 2
        : null;

      const expectedWidth =
        sectionRect && selectedPlacement
          ? (selectedPlacement.widthPercent / 100) * sectionRect.width
          : null;

      const next: DiagnosticSample = {
        at: Date.now(),
        pointerX: pointer?.x ?? null,
        pointerY: pointer?.y ?? null,
        viewportScrollLeft: viewport?.scrollLeft ?? 0,
        viewportScrollTop: viewport?.scrollTop ?? 0,
        frameLeft: frameRect?.left ?? null,
        frameTop: frameRect?.top ?? null,
        frameWidth: frameRect?.width ?? null,
        sectionLeft: sectionRect?.left ?? null,
        sectionTop: sectionRect?.top ?? null,
        sectionWidth: sectionRect?.width ?? null,
        sectionHeight: sectionRect?.height ?? null,
        targetLeft: targetRect?.left ?? null,
        targetTop: targetRect?.top ?? null,
        targetWidth: targetRect?.width ?? null,
        targetHeight: targetRect?.height ?? null,
        expectedCenterX,
        expectedCenterY,
        actualCenterX,
        actualCenterY,
        centerDeltaX:
          expectedCenterX !== null && actualCenterX !== null
            ? actualCenterX - expectedCenterX
            : null,
        centerDeltaY:
          expectedCenterY !== null && actualCenterY !== null
            ? actualCenterY - expectedCenterY
            : null,
        expectedWidth,
        widthDelta:
          expectedWidth !== null && targetRect
            ? targetRect.width - expectedWidth
            : null,
        frameTransform: frameStyle?.transform ?? '—',
        frameZoom: frameStyle?.zoom ?? '—',
        targetTransform: targetStyle?.transform ?? '—',
        targetFilter: targetStyle?.filter ?? '—',
        devicePixelRatio: window.devicePixelRatio,
      };

      setSample(next);
      setHistory((current) => [...current.slice(-19), next]);
    };

    capture();
    const handle = window.setInterval(capture, 100);

    return () => {
      window.clearInterval(handle);
    };
  }, [
    open,
    pointer,
    selectedElement,
    selectedPlacement,
    target,
    viewportRef,
    frameRef,
    zoomPercent,
    scale,
  ]);

  const status = useMemo(
    () => geometryStatus(sample),
    [sample],
  );

  const maxRecentJump = useMemo(() => {
    if (history.length < 2) return null;

    let maximum = 0;

    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const current = history[index];

      if (!previous || !current) continue;
      if (
        previous.actualCenterX === null ||
        previous.actualCenterY === null ||
        current.actualCenterX === null ||
        current.actualCenterY === null
      ) {
        continue;
      }

      const jump = Math.hypot(
        current.actualCenterX - previous.actualCenterX,
        current.actualCenterY - previous.actualCenterY,
      );

      maximum = Math.max(maximum, jump);
    }

    return maximum;
  }, [history]);

  if (!open) return null;

  const copyReport = async () => {
    const report = {
      capturedAt: new Date().toISOString(),
      browser: navigator.userAgent,
      breakpoint,
      zoomPercent,
      scale,
      fitMode,
      frameWidth,
      totalHeight,
      selectedElement: selectedElement
        ? {
            id: selectedElement.id,
            type: selectedElement.type,
            effects: selectedElement.effects ?? null,
          }
        : null,
      selectedPlacement: selectedPlacement ?? null,
      current: sample,
      recentSamples: history,
      isolation: {
        disableEffects,
        hideMoveable,
      },
    };

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(report, null, 2),
      );
      setCopyState('Rapport copié');
    } catch {
      setCopyState('Copie refusée');
    }

    window.setTimeout(() => {
      setCopyState('Copier le rapport');
    }, 1800);
  };

  return (
    <aside className="canvas-diagnostics" aria-label="Diagnostic du canevas">
      <header className="canvas-diagnostics__header">
        <div>
          <strong>Diagnostic canevas</strong>
          <span>
            {breakpoint} · {zoomPercent}% {fitMode ? '· ajusté' : ''}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fermer le diagnostic"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className={`canvas-diagnostics__status ${status.className}`}>
        {status.label}
      </div>

      <div className="canvas-diagnostics__grid">
        <span>Placement</span>
        <code>
          x {format(selectedPlacement?.xPercent ?? null, '%')} · y{' '}
          {format(selectedPlacement?.yPercent ?? null, '%')} · w{' '}
          {format(selectedPlacement?.widthPercent ?? null, '%')}
        </code>

        <span>Centre attendu</span>
        <code>
          {format(sample?.expectedCenterX ?? null)} /{' '}
          {format(sample?.expectedCenterY ?? null)}
        </code>

        <span>Centre réel</span>
        <code>
          {format(sample?.actualCenterX ?? null)} /{' '}
          {format(sample?.actualCenterY ?? null)}
        </code>

        <span>Delta centre</span>
        <code>
          {format(sample?.centerDeltaX ?? null)} /{' '}
          {format(sample?.centerDeltaY ?? null)}
        </code>

        <span>Largeur attendue</span>
        <code>{format(sample?.expectedWidth ?? null, 'px')}</code>

        <span>Largeur réelle</span>
        <code>{format(sample?.targetWidth ?? null, 'px')}</code>

        <span>Delta largeur</span>
        <code>{format(sample?.widthDelta ?? null, 'px')}</code>

        <span>Pointeur</span>
        <code>
          {format(sample?.pointerX ?? null)} /{' '}
          {format(sample?.pointerY ?? null)}
        </code>

        <span>Scroll canevas</span>
        <code>
          {format(sample?.viewportScrollLeft ?? null)} /{' '}
          {format(sample?.viewportScrollTop ?? null)}
        </code>

        <span>Frame DOM</span>
        <code>
          {format(sample?.frameWidth ?? null, 'px')} · DPR{' '}
          {format(sample?.devicePixelRatio ?? null)}
        </code>

        <span>Saut max récent</span>
        <code>{format(maxRecentJump, 'px')}</code>
      </div>

      <details>
        <summary>Styles calculés</summary>
        <dl className="canvas-diagnostics__styles">
          <dt>frame transform</dt>
          <dd>{sample?.frameTransform ?? '—'}</dd>
          <dt>frame zoom</dt>
          <dd>{sample?.frameZoom ?? '—'}</dd>
          <dt>target transform</dt>
          <dd>{sample?.targetTransform ?? '—'}</dd>
          <dt>target filter</dt>
          <dd>{sample?.targetFilter ?? '—'}</dd>
        </dl>
      </details>

      <div className="canvas-diagnostics__isolations">
        <label>
          <input
            type="checkbox"
            checked={disableEffects}
            onChange={(event) =>
              setDisableEffects(event.currentTarget.checked)
            }
          />
          Désactiver ombres et lueurs
        </label>

        <label>
          <input
            type="checkbox"
            checked={hideMoveable}
            onChange={(event) =>
              setHideMoveable(event.currentTarget.checked)
            }
          />
          Masquer l’interface Moveable
        </label>
      </div>

      <div className="canvas-diagnostics__actions">
        <button type="button" onClick={() => setHistory([])}>
          Effacer l’historique
        </button>
        <button type="button" onClick={() => void copyReport()}>
          {copyState}
        </button>
      </div>
    </aside>
  );
}
