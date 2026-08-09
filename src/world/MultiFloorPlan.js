export function createMultiFloorPlan(height, { floorHeight = 4, hasElevator = true, hasStairs = true } = {}) {
  const floorCount = Math.max(2, Math.floor(height / floorHeight));
  const alignedHeight = floorCount * floorHeight;
  return {
    floorHeight, floorCount, alignedHeight, hasElevator, hasStairs,
    floors: Array.from({ length: floorCount }, (_, index) => ({ index, y: index * floorHeight, ceilingY: (index + 1) * floorHeight })),
  };
}
