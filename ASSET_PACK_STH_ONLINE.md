# SubwayThotsHotel Online — Modular Character Creator Asset Pack

## Generated files

- `sth-online-character-creator-ui.png` — introduction/customizer UI mockup
- `sth-online-faces-sheet.png` — Face_01 through Face_10
- `sth-online-arms-sheet.png` — Arms_01 through Arms_10
- `sth-online-torsos-sheet.png` — Torso_01 through Torso_10
- `sth-online-legs-sheet.png` — Legs_01 through Legs_10

## Slot contract

```js
const characterSlots = {
  face: Array.from({ length: 10 }, (_, i) => `Face_${String(i + 1).padStart(2, '0')}`),
  arms: Array.from({ length: 10 }, (_, i) => `Arms_${String(i + 1).padStart(2, '0')}`),
  torso: Array.from({ length: 10 }, (_, i) => `Torso_${String(i + 1).padStart(2, '0')}`),
  legs: Array.from({ length: 10 }, (_, i) => `Legs_${String(i + 1).padStart(2, '0')}`),
};
```

## Design rules

- All references depict adult characters.
- Face references are front-facing and aligned for consistent head scale.
- Arms include shoulder-compatible upper-body framing and tattoo/jewelry variation.
- Torso references use opaque base layers for safe modular production reference.
- Legs use opaque shorts, leggings, jeans, or fitted lower-body base layers.
- Sheets use neutral studio backgrounds and consistent front-facing presentation.

## Runtime implementation path

These PNGs are concept and texture-reference assets, not rigged 3D meshes. The next production step is to author one shared adult base body in Blender, split it into compatible face/arm/torso/leg mesh variants, then export optimized GLB files with shared skeleton, skin materials, morph targets, and LODs.

Recommended online editor state:

```json
{
  "face": "Face_01",
  "arms": "Arms_01",
  "torso": "Torso_01",
  "legs": "Legs_01"
}
```

## Male-presenting slot library

```js
const maleCharacterSlots = {
  face: Array.from({ length: 10 }, (_, i) => `Male_Face_${String(i + 1).padStart(2, '0')}`),
  arms: Array.from({ length: 10 }, (_, i) => `Male_Arms_${String(i + 1).padStart(2, '0')}`),
  torso: Array.from({ length: 10 }, (_, i) => `Male_Torso_${String(i + 1).padStart(2, '0')}`),
  legs: Array.from({ length: 10 }, (_, i) => `Male_Legs_${String(i + 1).padStart(2, '0')}`),
};
```

Generated male sheets:

- `sth-online-male-faces.png` — Male_Face_01 through Male_Face_10
- `sth-online-male-arms.png` — Male_Arms_01 through Male_Arms_10
- `sth-online-male-torsos.png` — Male_Torso_01 through Male_Torso_10
- `sth-online-male-legs.png` — Male_Legs_01 through Male_Legs_10

Both libraries are designed as adult modular character references. Runtime production still requires shared-skeleton GLB mesh variants authored from these references.
