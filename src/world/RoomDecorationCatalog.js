export const ROOM_DECORATION_CATALOG = Object.freeze([
  { type: 'sofa', name: 'Lounge Sofa', category: 'seating' },
  { type: 'lamp', name: 'Floor Lamp', category: 'lighting' },
  { type: 'plant', name: 'Plant', category: 'decor' },
  { type: 'art', name: 'Wall Art', category: 'decor' },
  { type: 'table', name: 'Cafe Table', category: 'surface' },
  { type: 'bar', name: 'Bar Counter', category: 'hospitality' },
  { type: 'rug', name: 'Area Rug', category: 'surface' },
]);

export function normalizeRoomLayout(value) {
  const items = Array.isArray(value?.items) ? value.items : [];
  return {
    version: 1,
    items: items.filter((item) => ROOM_DECORATION_CATALOG.some((entry) => entry.type === item?.type)).slice(0, 40).map((item, index) => ({
      id: String(item.id || `decoration-${index}`).slice(0, 64),
      type: item.type,
      x: Math.max(-8.1, Math.min(8.1, Number(item.x) || 0)),
      y: Math.max(0, Math.min(6.8, Number(item.y) || 0)),
      z: Math.max(-8.1, Math.min(8.1, Number(item.z) || 0)),
      rotation: Math.max(-Math.PI * 4, Math.min(Math.PI * 4, Number(item.rotation) || 0)),
      scale: Math.max(.5, Math.min(2, Number(item.scale) || 1)),
    })),
  };
}
