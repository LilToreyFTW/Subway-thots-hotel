# Native game core

This folder is the native C++ foundation for Subway Thots Hotel. It is intentionally dependency-free and uses standard C++17, making it compatible with Visual Studio and CMake before a renderer and platform layer are introduced.

## Visual Studio

Open the repository folder in Visual Studio with CMake support, or choose `native-game/CMakeLists.txt` directly. Build and run `sth_game` or `sth_game_tests`.

## Command line

```powershell
cmake -S native-game -B native-game/build
cmake --build native-game/build --config Debug
ctest --test-dir native-game/build -C Debug --output-on-failure
```

The first native slice contains the shared game state, player movement bounds, venue geometry metadata, the outdoor Neon Arsenal lot, and weapon purchase/equip rules. Rendering, input, persistence, networking, and the desktop platform layer will be added on top of this core.
