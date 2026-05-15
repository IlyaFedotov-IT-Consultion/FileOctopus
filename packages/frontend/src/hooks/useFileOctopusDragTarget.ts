import { useCallback, useRef, useState, type DragEvent } from "react";

const URI_MIME = "application/x-fileoctopus-uri";

export function useFileOctopusDragTarget() {
  const [dragOver, setDragOver] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setDragOver(false);
  }, []);

  const accepts = useCallback((event: DragEvent) => {
    return event.dataTransfer.types.includes(URI_MIME);
  }, []);

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current += 1;
      setDragOver(true);
    },
    [accepts],
  );

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setDragOver(false);
      }
    },
    [accepts],
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [accepts],
  );

  return {
    dragOver,
    reset,
    dragTargetProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
    },
  };
}

export function readDraggedUri(event: DragEvent): string | null {
  const uri = event.dataTransfer.getData(URI_MIME);
  return uri || null;
}
