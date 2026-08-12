"""Visibility rules for shared districts and private hotel suites."""


def can_share_presence(observer, subject) -> bool:
    if observer.player_id == subject.player_id:
        return True
    if observer.zone != subject.zone:
        return False
    if observer.zone == 'room':
        return observer.room_id is not None and observer.room_id == subject.room_id
    return True
