#include "sth/Game.h"

#include <cassert>
#include <string>

int main() {
    sth::Game game;
    assert(game.weapons().size() == 10);
    assert(game.venues().size() == 5);
    assert(game.venues().front().outdoor);

    std::string message;
    assert(game.buyAndEquipWeapon("velvet-9", message));
    assert(game.player().cash == 2080);
    assert(game.player().equippedWeapon == "velvet-9");
    assert(game.buyAndEquipWeapon("velvet-9", message));
    assert(game.player().cash == 2080);
    assert(!game.buyAndEquipWeapon("skyline-precision", message));

    assert(game.movePlayer(10.0f, -9.0f));
    assert(game.isInsideVenue("neon-arsenal"));
    assert(!game.movePlayer(45.0f, -4.0f));
    assert(!game.isInsideVenue("missing-venue"));
    return 0;
}
