/** Modular grid for structure footprints, spans, walls, and openings. */
import { NavigationStandards } from './NavigationStandards.js';

export class StructuralGrid {
  constructor(moduleSize = 2, detailSize = .25) { this.moduleSize = moduleSize; this.detailSize = detailSize; }
  snap(value, step = this.moduleSize) { return Math.round(value / step) * step; }
  snapSize(value, min = this.moduleSize) { return Math.max(min, this.snap(value)); }
  snapPosition(x, z) { return { x: this.snap(x), z: this.snap(z) }; }
  footprint({ x, z, width, depth, height = 0 }) {
    const position = this.snapPosition(x, z);
    return { ...position, width: this.snapSize(width), depth: this.snapSize(depth), height: height ? this.snapSize(height) : height };
  }
  opening(width) { return this.snapSize(Math.max(width, NavigationStandards.minimumDoorWidth), this.moduleSize); }
  hallway(width) { return this.snapSize(Math.max(width, NavigationStandards.minimumHallwayWidth), this.moduleSize); }
  ceiling(height) { return this.snapSize(Math.max(height, NavigationStandards.minimumCeilingHeight), this.moduleSize); }
}
