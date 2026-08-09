export function disposeMaterial(material, seen = new Set()) {
  if (!material || seen.has(material)) return;
  seen.add(material);
  for (const value of Object.values(material)) if (value?.isTexture && !seen.has(value)) { seen.add(value); value.dispose(); }
  material.dispose?.();
}

export function disposeOwnedResources({ geometries = [], materials = [] } = {}) {
  geometries.forEach((geometry) => geometry?.dispose?.());
  materials.forEach((material) => disposeMaterial(material));
}
