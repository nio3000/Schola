import { useCallback, useEffect, useRef } from 'react';

export interface ResizeHandleOptions {
  /** Called with incremental delta X on every pointer move. */
  readonly onDelta?: (deltaX: number) => void;
  /** Called with incremental delta Y on every pointer move. */
  readonly onDeltaY?: (deltaY: number) => void;
  /** Optional: called on double-click (reset to default). */
  readonly onDoubleClick?: () => void;
}

export interface ResizeHandle {
  readonly onPointerDown: (e: React.PointerEvent) => void;
  /** Attach to the resizer DOM element for is-dragging class toggling. */
  readonly resizerRef: React.RefCallback<HTMLElement>;
}

/**
 * Generic hook for horizontal resize handles.
 *
 * Reports **incremental** delta per frame so consumers can safely
 * use `setState(prev => prev + delta)` without double-counting.
 *
 * Manages:
 * - Window-level pointermove / pointerup (drag survives cursor leaving resizer)
 * - is-resizing on document.body + is-dragging on the resizer element
 * - user-select: none during drag
 * - Optional double-click to reset
 * - Cleanup on unmount
 */
export function useResizeHandle(options: ResizeHandleOptions): ResizeHandle {
  const { onDelta, onDeltaY, onDoubleClick } = options;

  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const onDeltaRef = useRef(onDelta);
  const onDeltaYRef = useRef(onDeltaY);
  const onDoubleClickRef = useRef(onDoubleClick);
  const resizerElRef = useRef<HTMLElement | null>(null);
  const lastClickTimeRef = useRef(0);

  // Keep callbacks current without triggering re-renders
  useEffect(() => {
    onDeltaRef.current = onDelta;
  });
  useEffect(() => {
    onDeltaYRef.current = onDeltaY;
  });
  useEffect(() => {
    onDoubleClickRef.current = onDoubleClick;
  });

  const resizerRef = useCallback((el: HTMLElement | null) => {
    resizerElRef.current = el;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      e.preventDefault();

      // Double-click detection (within 400 ms)
      const now = Date.now();
      if (onDoubleClickRef.current && now - lastClickTimeRef.current < 400) {
        lastClickTimeRef.current = 0;
        onDoubleClickRef.current();
        return;
      }
      lastClickTimeRef.current = now;

      draggingRef.current = true;
      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;

      document.body.classList.add('is-resizing');
      document.body.style.userSelect = 'none';

      if (resizerElRef.current) {
        resizerElRef.current.classList.add('is-dragging');
      }

      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // Pointer capture best-effort
      }
    },
    [],
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent): void => {
      if (!draggingRef.current) return;
      const deltaX = e.clientX - lastXRef.current;
      const deltaY = e.clientY - lastYRef.current;
      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;
      onDeltaRef.current?.(deltaX);
      onDeltaYRef.current?.(deltaY);
    };

    const handleUp = (): void => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.classList.remove('is-resizing');
      document.body.style.userSelect = '';

      if (resizerElRef.current) {
        resizerElRef.current.classList.remove('is-dragging');
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      // Safety: restore classes if unmounting mid-drag
      if (draggingRef.current) {
        document.body.classList.remove('is-resizing');
        document.body.style.userSelect = '';
        draggingRef.current = false;
      }
      if (resizerElRef.current) {
        resizerElRef.current.classList.remove('is-dragging');
      }
    };
  }, []);

  return { onPointerDown, resizerRef };
}
