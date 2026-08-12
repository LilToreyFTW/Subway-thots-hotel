from room_layout import validate_room_layout


def test_layout_accepts_allowed_decorations_and_clamps_bounds():
    layout = validate_room_layout({'items': [{'id': 'lamp-1', 'type': 'lamp', 'x': 99, 'y': -1, 'z': 0, 'rotation': 0, 'scale': 9}]})
    assert layout['items'][0]['x'] == 8.1
    assert layout['items'][0]['y'] == 0.0
    assert layout['items'][0]['scale'] == 2.0


def test_layout_rejects_scripts_unknown_types_and_excess_items():
    raw = [{'type': 'script', 'x': 0, 'y': 0, 'z': 0, 'rotation': 0, 'scale': 1}]
    raw.extend({'type': 'plant', 'x': 0, 'y': 0, 'z': 0, 'rotation': 0, 'scale': 1} for _ in range(50))
    result = validate_room_layout({'items': raw})
    assert len(result['items']) == 40
    assert all(item['type'] == 'plant' for item in result['items'])
