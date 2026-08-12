from movement_rules import clamp_position, validate_input, validate_transition


def test_input_and_transition_rules_reject_client_authority_abuse():
    assert validate_input(1, -1) == (True, 'OK')
    assert validate_input(2, 0)[1] == 'INVALID_INPUT_RANGE'
    assert validate_transition('city', 'room')[1] == 'INVALID_ZONE_TRANSITION'
    assert validate_transition('city', 'room', debug=True)[0] is True


def test_position_bounds_are_server_owned():
    assert clamp_position(999, -999, 'hotel') == (22.0, -22.0)
