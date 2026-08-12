#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace sth {

struct Vec3 {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
};

struct Player {
    std::string name;
    Vec3 position{0.0f, 0.0f, 0.0f};
    int cash = 2500;
    std::vector<std::string> ownedWeapons;
    std::string equippedWeapon;
};

struct Weapon {
    std::string key;
    std::string name;
    std::string category;
    int price = 0;
};

struct Venue {
    std::string key;
    std::string name;
    std::string type;
    Vec3 position;
    float width = 0.0f;
    float depth = 0.0f;
    bool outdoor = false;
};

class Game {
public:
    Game();

    const Player& player() const noexcept;
    const std::vector<Weapon>& weapons() const noexcept;
    const std::vector<Venue>& venues() const noexcept;

    bool movePlayer(float dx, float dz);
    bool buyAndEquipWeapon(const std::string& weaponKey, std::string& message);
    bool equipWeapon(const std::string& weaponKey, std::string& message);
    bool isInsideVenue(const std::string& venueKey) const;

private:
    Player player_;
    std::vector<Weapon> weapons_;
    std::vector<Venue> venues_;

    const Weapon* findWeapon(const std::string& weaponKey) const noexcept;
    const Venue* findVenue(const std::string& venueKey) const noexcept;
    bool ownsWeapon(const std::string& weaponKey) const;
};

} // namespace sth
