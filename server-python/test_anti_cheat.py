from anti_cheat import AntiCheat, AntiCheatConfig, AntiCheatState, create_debug_token, verify_debug_token


def test_debug_token_is_bound_and_expires():
    secret = "s" * 32
    token = create_debug_token("admin-1", 500, secret)
    assert verify_debug_token(token, "admin-1", secret, now=499)
    assert not verify_debug_token(token, "player-1", secret, now=499)
    assert not verify_debug_token(token, "admin-1", secret, now=500)


def test_input_rate_and_strike_threshold():
    anti_cheat = AntiCheat(AntiCheatConfig(max_strikes=2, max_inputs_per_second=2, debug_secret=""))
    state = AntiCheatState()
    assert anti_cheat.input_allowed("p1", state, 1.0)
    assert anti_cheat.input_allowed("p1", state, 1.1)
    assert not anti_cheat.input_allowed("p1", state, 1.2)
    assert anti_cheat.input_allowed("p1", state, 2.2)
    assert anti_cheat.violation("p1", state, "test")


def test_forbidden_state_mutations_are_not_client_authority():
    anti_cheat = AntiCheat(AntiCheatConfig())
    assert anti_cheat.forbidden_message("give_weapon")
    assert anti_cheat.forbidden_message("god_mode")
    assert anti_cheat.forbidden_message("noclip")
    assert not anti_cheat.forbidden_message("input")
