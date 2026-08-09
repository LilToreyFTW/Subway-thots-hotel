const HOTEL_ROOM = {
  id: 'hotel-room', minimumSize: { width: 14, depth: 14 }, maximumSize: { width: 18, depth: 18 },
  requiredProps: ['bed', 'nightstand', 'lamp', 'door'], optionalProps: ['tv', 'desk', 'chair', 'dresser', 'bathroom', 'closet'],
  doorRules: { wall: 'south', centered: true, minimumClearance: 1.2 }, windowRules: { wall: 'north', minimumWidth: 4, maximumWidth: 8 },
  lightingRules: { ambient: 'warm', fixture: 'bedside + ceiling', intensity: 12 }, materialRules: { floor: 'wood', walls: 'wall-paint', trim: 'metal' },
};
const VIP_SUITE = {
  ...HOTEL_ROOM, id: 'vip-suite', minimumSize: { width: 17, depth: 17 }, maximumSize: { width: 22, depth: 22 },
  requiredProps: [...HOTEL_ROOM.requiredProps, 'lounge'], optionalProps: ['tv', 'desk', 'chair', 'dresser', 'bathroom', 'closet', 'bar'],
  lightingRules: { ambient: 'warm + city glow', fixture: 'bedside + floor + ceiling', intensity: 18 }, materialRules: { floor: 'wood + carpet', walls: 'wall-paint', trim: 'gold metal' },
};

export const RoomArchetypes = Object.freeze({ HotelRoom: HOTEL_ROOM, VipSuite: VIP_SUITE });

/** Deterministically selects an archetype and optional prop set from a room number. */
export function createRoomPlan(roomNumber) {
  const archetype = roomNumber % 5 === 0 ? VIP_SUITE : HOTEL_ROOM;
  const optionalProps = archetype.optionalProps.filter((_, index) => ((roomNumber * 17 + index * 11) % 3) !== 0);
  return { archetype, width: 18, depth: 18, props: new Set([...archetype.requiredProps, ...optionalProps]) };
}
