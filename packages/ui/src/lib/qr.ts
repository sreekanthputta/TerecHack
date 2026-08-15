export function pseudoQr(seed: string): boolean[] {
  const size = 21;
  const arr: boolean[] = new Array(size * size).fill(false);
  const fmarks: Array<[number, number]> = [
    [0, 0],
    [14, 0],
    [0, 14],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inFid = false;
      let fidOn = false;
      for (const [fx, fy] of fmarks) {
        if (x >= fx && x < fx + 7 && y >= fy && y < fy + 7) {
          const dx = x - fx;
          const dy = y - fy;
          inFid = true;
          fidOn =
            dx === 0 ||
            dx === 6 ||
            dy === 0 ||
            dy === 6 ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
          break;
        }
      }
      if (inFid) {
        arr[y * size + x] = fidOn;
        continue;
      }
      const v = ((x * 13 + y * 7 + (x ^ y) * 3 + (h & 0xff)) % 5) < 2;
      arr[y * size + x] = v;
    }
  }
  return arr;
}
