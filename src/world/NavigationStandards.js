export const NavigationStandards = Object.freeze({
  minimumDoorWidth: 1.2,
  minimumHallwayWidth: 1.6,
  minimumCeilingHeight: 2.45,
  doorwayClearance: 0.7,
});

export function validatePlacement(candidate, occupied = [], clearance = .12) {
  return !occupied.some((area) => !(
    candidate.maxX + clearance <= area.minX || candidate.minX - clearance >= area.maxX ||
    candidate.maxZ + clearance <= area.minZ || candidate.minZ - clearance >= area.maxZ
  ));
}

export function hasWalkableOpening(width, height) {
  return width >= NavigationStandards.minimumDoorWidth && height >= NavigationStandards.minimumCeilingHeight;
}
