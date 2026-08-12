# Subway Thots Hotel — World Direction

## Product promise

Subway Thots Hotel is an adults-only, fictional, consent-first after-dark city simulation. Players move through a readable city, a luxury hotel, adult nightlife venues, and contract-driven equipment spaces. Every character is an adult; hosting and relationship interactions remain optional, private, and consent-based.

## Runtime track

- Plain Three.js + Vite
- DOM overlays for shops, room directory, HUD, and accessibility-sensitive text
- Procedural geometry for the first playable environment pass
- GLB/glTF 2.0 for future authored characters, weapons, signage, and venue props
- Simulation data stays in content modules/local persistence; scene meshes remain render adapters

## First playable world slice

1. **Station District** — existing subway, hotel exterior, streets, food stand, and nightlife signage remain the navigation spine.
2. **Neon Arsenal** — city gun shop selling fictional pistols, SMGs, ARs, rifles, sniper rifles, minigun, RPG, EMP device, and explosive device. Purchases are in-game catalog items only; no real-world construction or handling instructions are represented.
3. **Velvet Stage** — adults-only strip-club venue with stage, dressing/host areas, consent-first host booking interaction, and a drinks counter.
4. **Midnight Mile Bar 28** — late-night bar venue placed far down the city route as a destination rather than a menu shortcut.
5. **Subway Thots Hotel** — preserve 50 rooms across five secured floors while upgrading the shared lobby, bar, lounge, materials, lighting, wayfinding, and service zones.
6. **Hotel Hosting Suites** — existing individual suite flow is retained; adult hosting remains private, optional, and consent-first.

## Design language

- smoked glass, brass/champagne trim, walnut, deep plum, midnight teal, magenta/cyan neon
- low-chrome HUD; the playfield stays readable during traversal
- venue signage provides orientation without turning the city into a wall of UI
- NPCs visibly navigate, pause, turn, and use the spaces instead of only animating in place

## Content contract

Stable runtime keys live in `src/content/WorldContent.js`. The catalog is intentionally fictional and game-facing: weapon names, prices, stats, and descriptions support progression and shop UX without modeling real-world weapon manufacture.

## Delivery order

- [x] Establish content catalog and architectural direction
- [x] Commit every implementation step to the current repository branch
- [x] Wire Neon Arsenal fictional weapon purchase/equip state into server-owned cash, inventory, and profile persistence
- [x] Build Neon Arsenal geometry and shop overlay
- [x] Build Velvet Stage and Midnight Mile Bar 28 geometry/interactions
- [x] Remodel hotel surfaces while preserving room count and suite flow
- [x] Add venue-focused NPC routes and activity states
- [x] Add representative authored/generated GLB asset pack and automated manifest validation
- [x] Run a fresh browser visual smoke playtest and production bundle performance pass
