/** Advance cursor after processing `bairrosProcessed` neighborhoods; wrap to 0 at end. */
export function advanceBairroCursor(
  currentIndex: number,
  bairroCount: number,
  bairrosProcessed: number,
): number {
  if (bairroCount <= 0) {
    return 0;
  }
  let next = currentIndex + bairrosProcessed;
  if (next >= bairroCount) {
    next = 0;
  }
  return next;
}

export function sliceBairrosForRun(
  orderedBairros: string[],
  startIndex: number,
  maxBairros: number,
): { slice: string[]; bairrosProcessed: number } {
  if (orderedBairros.length === 0 || maxBairros <= 0) {
    return { slice: [], bairrosProcessed: 0 };
  }
  const start = Math.min(Math.max(0, startIndex), orderedBairros.length);
  const slice = orderedBairros.slice(start, start + maxBairros);
  return { slice, bairrosProcessed: slice.length };
}
