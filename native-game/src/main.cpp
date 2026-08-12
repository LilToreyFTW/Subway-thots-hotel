#include "sth/Game.h"

#include <iostream>

int main() {
    sth::Game game;
    std::cout << "Subway Thots Hotel native game core\n";
    std::cout << "Venues: " << game.venues().size() << " | Weapons: " << game.weapons().size() << "\n";

    std::string message;
    game.buyAndEquipWeapon("velvet-9", message);
    std::cout << message << " Cash: $" << game.player().cash << "\n";
    return 0;
}
