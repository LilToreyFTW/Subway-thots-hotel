cmake_minimum_required(VERSION 3.21)
project(SubwayThotsHotelNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(sth_game_core
    src/Game.cpp
)
target_include_directories(sth_game_core PUBLIC include)

if (MSVC)
    target_compile_options(sth_game_core PRIVATE /W4 /permissive-)
else()
    target_compile_options(sth_game_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(sth_game
    src/main.cpp
)
target_link_libraries(sth_game PRIVATE sth_game_core)

enable_testing()
add_executable(sth_game_tests
    tests/GameTests.cpp
)
target_link_libraries(sth_game_tests PRIVATE sth_game_core)
add_test(NAME sth_game_tests COMMAND sth_game_tests)
