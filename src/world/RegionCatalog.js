// Regions are real WGS84 anchors. Road/building content is deterministic procedural data
// until an OSM/licensed provider is connected for that region.
export const RegionCatalog = Object.freeze({
  countries: [
    { code: 'US', label: 'United States', regions: ['us-seattle-central', 'us-new-york-midtown'] },
    { code: 'CA', label: 'Canada', regions: ['ca-vancouver-downtown'] },
    { code: 'GB', label: 'United Kingdom', regions: ['gb-london-soho'] },
    { code: 'JP', label: 'Japan', regions: ['jp-tokyo-shibuya'] },
  ],
  regions: {
    'us-seattle-central': { country: 'US', city: 'Seattle', label: 'Seattle — Central District', latitude: 47.6086, longitude: -122.3354, seed: 843102, assetManifest: '/world/regions/us-seattle-central.json' },
    'us-new-york-midtown': { country: 'US', city: 'New York', label: 'New York — Midtown', latitude: 40.7580, longitude: -73.9855, seed: 947201, assetManifest: null },
    'ca-vancouver-downtown': { country: 'CA', city: 'Vancouver', label: 'Vancouver — Downtown', latitude: 49.2827, longitude: -123.1207, seed: 772090, assetManifest: null },
    'gb-london-soho': { country: 'GB', city: 'London', label: 'London — Soho', latitude: 51.5136, longitude: -0.1365, seed: 660429, assetManifest: null },
    'jp-tokyo-shibuya': { country: 'JP', city: 'Tokyo', label: 'Tokyo — Shibuya', latitude: 35.6595, longitude: 139.7005, seed: 905117, assetManifest: null },
  },
});
