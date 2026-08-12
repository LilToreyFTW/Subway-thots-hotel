#include "sth/Game.h"

#include <algorithm>
#include <cmath>

namespace sth {

Game::Game()
    : player_{"Player", {0.0f, 0.0f, -27.0f}, 2500, {}, ""},
      weapons_{
          {"velvet-9", "Velvet 9", "pistol", 420},
          {"afterglow-45", "Afterglow .45", "pistol", 760},
          {"metro-smg", "Metro SMG", "smg", 980},
          {"nightline-carbine", "Nightline Carbine", "ar", 1550},
          {"hotel-security-rifle", "Hotel Security Rifle", "rifle", 2100},
          {"skyline-precision", "Skyline Precision", "sniper", 3450},
          {"velvet-minigun", "Velvet Minigun", "minigun", 6200},
          {"redline-rpg", "Redline RPG", "rpg", 4800},
          {"pulse-emp", "Pulse EMP", "emp", 1800},
          {"flash-charge", "Flash Charge", "explosive", 650},
      },
      venues_{
          {"neon-arsenal", "Neon Arsenal", "gun-shop", {10.0f, 0.0f, -36.0f}, 18.0f, 16.0f, true},
          {"diamond-lane-motors", "Diamond Lane Motors", "car-dealership", {55.0f, 0.0f, -40.0f}, 16.0f, 12.0f, false},
          {"blacktop-customs", "Blacktop Customs", "car-mod-shop", {88.0f, 0.0f, -40.0f}, 16.0f, 12.0f, false},
          {"velvet-stage", "Velvet Stage", "adult-club", {38.0f, 0.0f, 36.0f}, 12.0f, 8.0f, false},
          {"midnight-mile", "Midnight Mile Bar 28", "bar", {38.0f, 0.0f, 56.0f}, 14.0f, 10.0f, false},
      } {
}

const Player& Game::player() const noexcept { return player_; }
const std::vector<Weapon>& Game::weapons() const noexcept { return weapons_; }
const std::vector<Venue>& Game::venues() const noexcept { return venues_; }

bool Game::movePlayer(float dx, float dz) {
    const Vec3 next{player_.position.x + dx, player_.position.y, player_.position.z + dz};
    if (next.x < -150.0f || next.x > 150.0f || next.z < -150.0f || next.z > 150.0f) return false;

    // Venue lots are navigable outdoor spaces; enclosed venue shells remain blocked.
    for (const Venue& venue : venues_) {
        if (venue.outdoor) continue;
        const float halfWidth = venue.width * 0.5f + 0.6f;
        const float halfDepth = venue.depth * 0.5f + 0.6f;
        if (std::abs(next.x - venue.position.x) < halfWidth && std::abs(next.z - venue.position.z) < halfDepth) return false;
    }
    player_.position = next;
    return true;
}

bool Game::buyAndEquipWeapon(const std::string& weaponKey, std::string& message) {
    const Weapon* weapon = findWeapon(weaponKey);
    if (weapon == nullptr) {
        message = "Weapon not found.";
        return false;
    }
    if (ownsWeapon(weaponKey)) return equipWeapon(weaponKey, message);
    if (player_.cash < weapon->price) {
        message = "Not enough cash for " + weapon->name + ".";
        return false;
    }
    player_.cash -= weapon->price;
    player_.ownedWeapons.push_back(weaponKey);
    player_.equippedWeapon = weaponKey;
    message = weapon->name + " purchased and equipped.";
    return true;
}

bool Game::equipWeapon(const std::string& weaponKey, std::string& message) {
    const Weapon* weapon = findWeapon(weaponKey);
    if (weapon == nullptr) {
        message = "Weapon not found.";
        return false;
    }
    if (!ownsWeapon(weaponKey)) {
        message = "Purchase the weapon before equipping it.";
        return false;
    }
    player_.equippedWeapon = weaponKey;
    message = weapon->name + " equipped.";
    return true;
}

bool Game::isInsideVenue(const std::string& venueKey) const {
    const Venue* venue = findVenue(venueKey);
    if (venue == nullptr) return false;
    return std::abs(player_.position.x - venue->position.x) <= venue->width * 0.5f &&
           std::abs(player_.position.z - venue->position.z) <= venue->depth * 0.5f;
}

const Weapon* Game::findWeapon(const std::string& weaponKey) const noexcept {
    const auto found = std::find_if(weapons_.begin(), weapons_.end(), [&weaponKey](const Weapon& weapon) { return weapon.key == weaponKey; });
    return found == weapons_.end() ? nullptr : &*found;
}

const Venue* Game::findVenue(const std::string& venueKey) const noexcept {
    const auto found = std::find_if(venues_.begin(), venues_.end(), [&venueKey](const Venue& venue) { return venue.key == venueKey; });
    return found == venues_.end() ? nullptr : &*found;
}

bool Game::ownsWeapon(const std::string& weaponKey) const {
    return std::find(player_.ownedWeapons.begin(), player_.ownedWeapons.end(), weaponKey) != player_.ownedWeapons.end();
}

} // namespace sth
