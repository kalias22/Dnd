export type GridCell = { x: number; y: number };

export type WorldPoint = { x: number; y: number };

const toCellCoordinate = (value: number, gridSize: number) => Math.round((value - gridSize / 2) / gridSize);
const toCellCenterCoordinate = (cell: number, gridSize: number) => cell * gridSize + gridSize / 2;

export const rectCells = (a: GridCell, b: GridCell): GridCell[] => {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cells: GridCell[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
};

export const circleCells = (center: GridCell, edge: GridCell): GridCell[] => {
  const dx = edge.x - center.x;
  const dy = edge.y - center.y;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const radiusSq = radius * radius;
  const minX = Math.floor(center.x - radius);
  const maxX = Math.ceil(center.x + radius);
  const minY = Math.floor(center.y - radius);
  const maxY = Math.ceil(center.y + radius);
  const cells: GridCell[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const testDx = x - center.x;
      const testDy = y - center.y;
      if (testDx * testDx + testDy * testDy <= radiusSq + 1e-9) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
};

const pointInPolygon = (point: WorldPoint, polygon: WorldPoint[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const polygonCells = (pointsWorld: WorldPoint[], gridSize: number): GridCell[] => {
  if (pointsWorld.length < 3) return [];

  let minWorldX = pointsWorld[0].x;
  let maxWorldX = pointsWorld[0].x;
  let minWorldY = pointsWorld[0].y;
  let maxWorldY = pointsWorld[0].y;
  for (let i = 1; i < pointsWorld.length; i += 1) {
    const point = pointsWorld[i];
    if (point.x < minWorldX) minWorldX = point.x;
    if (point.x > maxWorldX) maxWorldX = point.x;
    if (point.y < minWorldY) minWorldY = point.y;
    if (point.y > maxWorldY) maxWorldY = point.y;
  }

  const minCellX = toCellCoordinate(minWorldX, gridSize);
  const maxCellX = toCellCoordinate(maxWorldX, gridSize);
  const minCellY = toCellCoordinate(minWorldY, gridSize);
  const maxCellY = toCellCoordinate(maxWorldY, gridSize);
  const cells: GridCell[] = [];

  for (let y = minCellY; y <= maxCellY; y += 1) {
    for (let x = minCellX; x <= maxCellX; x += 1) {
      const center = {
        x: toCellCenterCoordinate(x, gridSize),
        y: toCellCenterCoordinate(y, gridSize),
      };
      if (pointInPolygon(center, pointsWorld)) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
};
