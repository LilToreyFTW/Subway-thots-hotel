from __future__ import annotations

import asyncio
import json
import math
import os
import re
import secrets
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

from dotenv import load_dotenv
from fastapi import Body, FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Float, Integer, String, create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from anti_cheat import AntiCheat, AntiCheatState
from profile_state import profile_snapshot

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./subway_thots_hotel.db")
TICK_RATE = max(5, int(os.getenv("REGION_TICK_RATE", "20")))
engine_kwargs: dict[str, Any] = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class PlayerProfile(Base):
    __tablename__ = "player_profiles"
    player_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80), default="Guest")
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    z: Mapped[float] = mapped_column(Float, default=8.0)
    region_id: Mapped[str] = mapped_column(String(80), default="sth-city-01")
    auth_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cash: Mapped[int] = mapped_column(Integer, default=240)
    reputation: Mapped[int] = mapped_column(Integer, default=12)
    weapons_json: Mapped[str] = mapped_column(String(8192), default='[]')
    vehicles_json: Mapped[str] = mapped_column(String(8192), default='[]')
    room_layout_json: Mapped[str] = mapped_column(String(32768), default='{}')


class GamertagRegistry(Base):
    __tablename__ = "gamertag_registry"
    tag: Mapped[str] = mapped_column(String(40), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(16), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)


@dataclass
class LivePlayer:
    player_id: str
    display_name: str
    websocket: WebSocket | None
    x: float = 0.0
    y: float = 0.0
    z: float = 8.0
    dx: float = 0.0
    dz: float = 0.0
    rotation: float = 0.0
    zone: str = "city"
    room_id: str | None = None
    gender: str = "female"
    selections: dict[str, str] = field(default_factory=dict)
    moving: bool = False
    last_chat: float = 0.0
    last_input: float = field(default_factory=time.monotonic)
    anti_cheat: AntiCheatState = field(default_factory=AntiCheatState)
    health: int = 100
    money: int = 0
    weapons: set[str] = field(default_factory=set)
    reputation: int = 12
    vehicles: set[str] = field(default_factory=set)
    room_layout: dict[str, Any] = field(default_factory=dict)


regions: dict[str, dict[str, LivePlayer]] = defaultdict(dict)
region_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
anti_cheat = AntiCheat()


def load_profile(player_id: str, display_name: str, region_id: str, presented_token: str) -> tuple[LivePlayer | None, str | None]:
    with SessionLocal() as db:
        profile = db.get(PlayerProfile, player_id)
        if profile is None:
            profile = PlayerProfile(player_id=player_id, display_name=display_name[:80], region_id=region_id, auth_token=secrets.token_urlsafe(32))
            db.add(profile)
            db.commit()
        else:
            if profile.auth_token and not secrets.compare_digest(profile.auth_token, presented_token):
                return None, None
            if not profile.auth_token:
                profile.auth_token = secrets.token_urlsafe(32)
            profile.display_name = display_name[:80] or profile.display_name
            profile.region_id = region_id
            db.commit()
        live = LivePlayer(
            player_id=profile.player_id, display_name=profile.display_name, websocket=None,
            x=profile.x, y=profile.y, z=profile.z,
            money=max(0, int(profile.cash or 0)), reputation=max(0, int(profile.reputation or 0)),
            weapons=set(_load_json_list(profile.weapons_json)),
            vehicles=set(_load_json_list(profile.vehicles_json)),
            room_layout=_load_json_object(profile.room_layout_json),
        )
        return live, profile.auth_token


def save_profile(player: LivePlayer, region_id: str) -> None:
    with SessionLocal() as db:
        profile = db.get(PlayerProfile, player.player_id)
        if profile is None:
            profile = PlayerProfile(player_id=player.player_id)
            db.add(profile)
        profile.display_name = player.display_name
        profile.x, profile.y, profile.z, profile.region_id = player.x, player.y, player.z, region_id
        profile.cash = max(0, int(player.money))
        profile.reputation = max(0, int(player.reputation))
        profile.weapons_json = json.dumps(sorted(player.weapons), separators=(',', ':'))
        profile.vehicles_json = json.dumps(sorted(player.vehicles), separators=(',', ':'))
        profile.room_layout_json = json.dumps(player.room_layout, separators=(',', ':'))
        db.commit()


def _load_json_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or '[]')
        return [str(item)[:80] for item in parsed] if isinstance(parsed, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _load_json_object(value: str | None) -> dict[str, Any]:
    try:
        parsed = json.loads(value or '{}')
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def snapshot(region_id: str) -> dict[str, Any]:
    return {
        "type": "snapshot",
        "regionId": region_id,
        "serverTime": time.time(),
        "players": [
            {
                "id": p.player_id,
                "displayName": p.display_name,
                "position": {"x": round(p.x, 3), "y": round(p.y, 3), "z": round(p.z, 3)},
                "rotation": round(p.rotation, 4),
                "zone": p.zone,
                "roomId": p.room_id,
                "gender": p.gender,
                "selections": p.selections,
                "moving": p.moving,
            }
            for p in regions[region_id].values()
        ],
    }


async def broadcast(region_id: str, payload: dict[str, Any]) -> None:
    stale: list[tuple[str, LivePlayer]] = []
    for player_id, player in list(regions[region_id].items()):
        if player.websocket is None:
            continue
        try:
            await player.websocket.send_json(payload)
        except Exception:
            stale.append((player_id, player))
    for player_id, failed_player in stale:
        if regions[region_id].get(player_id) is failed_player:
            regions[region_id].pop(player_id, None)


async def region_loop(region_id: str) -> None:
    step = 1.0 / TICK_RATE
    while True:
        started = time.monotonic()
        async with region_locks[region_id]:
            for player in list(regions[region_id].values()):
                bounds = 110.0 if player.zone == "city" else 22.0 if player.zone == "hotel" else 12.0
                player.x = max(-bounds, min(bounds, player.x + player.dx * step * 6.0))
                player.z = max(-bounds, min(bounds, player.z + player.dz * step * 6.0))
                if time.monotonic() - player.last_input > 0.75:
                    player.dx = player.dz = 0.0
            if regions[region_id]:
                await broadcast(region_id, snapshot(region_id))
        await asyncio.sleep(max(0.0, step - (time.monotonic() - started)))


region_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("player_profiles")}
    missing_columns = {
        "auth_token": "VARCHAR(128)", "cash": "INTEGER DEFAULT 240", "reputation": "INTEGER DEFAULT 12",
        "weapons_json": "VARCHAR(8192) DEFAULT '[]'", "vehicles_json": "VARCHAR(8192) DEFAULT '[]'",
        "room_layout_json": "VARCHAR(32768) DEFAULT '{}'",
    }
    with engine.begin() as connection:
        for name, definition in missing_columns.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE player_profiles ADD COLUMN {name} {definition}"))
    yield
    for task in region_tasks.values():
        task.cancel()


app = FastAPI(title="Subway Thots Hotel World Host", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "subway-thots-hotel-world", "database": DATABASE_URL.split(":", 1)[0], "regions": len(regions), "tickRate": TICK_RATE}


@app.post("/gamertag/allocate")
def allocate_gamertag(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    display_name = str(payload.get("displayName", "")).strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{3,16}", display_name):
        return {"ok": False, "error": "Display name must be 3-16 letters, numbers, dots, underscores, or hyphens."}
    for _ in range(100):
        number = secrets.randbelow(900000) + 100000
        tag = f"{display_name}#{number}"
        try:
            with SessionLocal() as db:
                db.add(GamertagRegistry(tag=tag, display_name=display_name, number=number))
                db.commit()
            return {"ok": True, "displayName": display_name, "number": number, "tag": tag}
        except IntegrityError:
            continue
    return {"ok": False, "error": "Unable to allocate a unique gamertag. Try again."}


@app.get("/regions")
def list_regions() -> dict[str, Any]:
    return {"regions": [{"id": region_id, "online": len(players)} for region_id, players in regions.items()]}


@app.websocket("/ws/{region_id}")
async def region_socket(websocket: WebSocket, region_id: str, player_id: str = Query(default=""), display_name: str = Query(default="Guest"), session_token: str = Query(default=""), ticket: str = Query(default="")):
    await websocket.accept()
    # Optional Discord-auth ticket enforcement (see notes above). When disabled,
    # this returns True immediately and play is unchanged.
    allowed = await _maybe_enforce_ticket(websocket, region_id, ticket)
    if not allowed:
        return
    player_id = (player_id or str(uuid.uuid4()))[:80]
    live, issued_token = load_profile(player_id, display_name, region_id, session_token[:128])
    if live is None or issued_token is None:
        await websocket.close(code=4401, reason="Invalid session token")
        return
    live.websocket = websocket
    debug_token = websocket.query_params.get("debug_token", "")
    live.anti_cheat.debug_mode = anti_cheat.debug_enabled(player_id, debug_token)
    async with region_locks[region_id]:
        previous = regions[region_id].get(player_id)
        if previous and previous.websocket is not None and previous.websocket is not websocket:
            try:
                await previous.websocket.close(code=4001, reason="Superseded by a newer connection")
            except Exception:
                pass
        regions[region_id][player_id] = live
        if region_id not in region_tasks or region_tasks[region_id].done():
            region_tasks[region_id] = asyncio.create_task(region_loop(region_id))
    await websocket.send_json({"type": "welcome", "playerId": player_id, "sessionToken": issued_token, "regionId": region_id, "serverTickRate": TICK_RATE, "debugMode": live.anti_cheat.debug_mode, "profile": profile_snapshot(live)})
    await broadcast(region_id, {"type": "presence", "action": "join", "playerId": player_id, "displayName": live.display_name})
    try:
        while True:
            try:
                message = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception:
                await websocket.send_json({"type": "error", "code": "INVALID_MESSAGE", "message": "Message must be valid JSON."})
                continue
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "code": "INVALID_MESSAGE", "message": "Message must be a JSON object."})
                continue
            message_type = message.get("type")
            if message_type == "input":
                if not live.anti_cheat.debug_mode and not anti_cheat.input_allowed(player_id, live.anti_cheat, time.monotonic()):
                    await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "Input rate exceeded."})
                    if live.anti_cheat.strikes >= anti_cheat.config.max_strikes:
                        await websocket.close(code=4003, reason="Anti-cheat violation")
                        break
                    continue
                try:
                    input_x = float(message.get("x", 0.0))
                    input_z = float(message.get("z", 0.0))
                except (TypeError, ValueError):
                    await websocket.send_json({"type": "error", "code": "INVALID_INPUT", "message": "Input axes must be numeric."})
                    continue
                if not math.isfinite(input_x) or not math.isfinite(input_z):
                    should_close = anti_cheat.violation(player_id, live.anti_cheat, "NON_FINITE_INPUT")
                    await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "Input axes must be finite."})
                    if should_close:
                        await websocket.close(code=4003, reason="Anti-cheat violation")
                        break
                    continue
                if abs(input_x) > 1.0 or abs(input_z) > 1.0:
                    should_close = anti_cheat.violation(player_id, live.anti_cheat, "INVALID_INPUT_RANGE", {"x": input_x, "z": input_z})
                    await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "Input axes exceeded the allowed range."})
                    if should_close:
                        await websocket.close(code=4003, reason="Anti-cheat violation")
                        break
                    continue
                live.dx = max(-1.0, min(1.0, input_x))
                live.dz = max(-1.0, min(1.0, input_z))
                requested_zone = str(message.get("zone", live.zone))
                requested_zone = requested_zone if requested_zone in {"city", "hotel", "room"} else live.zone
                room_id = str(message.get("roomId", ""))
                requested_room = room_id if requested_zone == "room" and room_id.isdigit() and 1 <= int(room_id) <= 50 else None
                if requested_zone == "room" and requested_room is None:
                    requested_zone = "hotel"
                if requested_zone != live.zone or requested_room != live.room_id:
                    valid_transition = ((live.zone, requested_zone) in {("city", "hotel"), ("hotel", "city"), ("hotel", "room"), ("room", "hotel")})
                    if not valid_transition and not live.anti_cheat.debug_mode:
                        should_close = anti_cheat.violation(player_id, live.anti_cheat, "INVALID_ZONE_TRANSITION", {"from": live.zone, "to": requested_zone})
                        await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "Invalid zone transition."})
                        if should_close:
                            await websocket.close(code=4003, reason="Anti-cheat violation")
                            break
                        continue
                    live.zone = requested_zone
                    live.room_id = requested_room
                    live.x, live.y, live.z = (0.0, 0.0, 8.0 if requested_zone == "city" else 12.0 if requested_zone == "hotel" else 7.0)
                try:
                    rotation = float(message.get("rotation", live.rotation))
                    if math.isfinite(rotation):
                        live.rotation = max(-100.0, min(100.0, rotation))
                except (TypeError, ValueError):
                    pass
                live.gender = "male" if message.get("gender") == "male" else "female"
                selections = message.get("selections")
                if isinstance(selections, dict):
                    live.selections = {str(key)[:16]: str(value)[:40] for key, value in selections.items() if key in {"face", "arms", "torso", "legs"}}
                live.moving = bool(message.get("moving", False))
                live.last_input = time.monotonic()
            elif message_type == "state":
                await websocket.send_json({"type": "error", "code": "STATE_NOT_ALLOWED", "message": "Send movement input instead of absolute position state."})
            elif anti_cheat.forbidden_message(str(message_type)):
                should_close = anti_cheat.violation(player_id, live.anti_cheat, "FORBIDDEN_STATE_MUTATION", {"type": message_type})
                await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "This state is server-authoritative."})
                if should_close:
                    await websocket.close(code=4003, reason="Anti-cheat violation")
                    break
            elif message_type == "admin_debug":
                if not live.anti_cheat.debug_mode:
                    should_close = anti_cheat.violation(player_id, live.anti_cheat, "UNAUTHORIZED_DEBUG")
                    await websocket.send_json({"type": "error", "code": "CHEAT_DETECTED", "message": "Debug mode is admin-only."})
                    if should_close:
                        await websocket.close(code=4003, reason="Anti-cheat violation")
                        break
                else:
                    await websocket.send_json({"type": "debug_ack", "enabled": True, "serverAuthoritative": True})
            elif message_type == "chat":
                text = str(message.get("text", "")).strip()[:240]
                if text:
                    now = time.monotonic()
                    if now - live.last_chat < 0.75:
                        await websocket.send_json({"type": "error", "code": "CHAT_RATE_LIMIT", "message": "Please wait before sending another message."})
                        continue
                    live.last_chat = now
                    await broadcast(region_id, {"type": "chat", "playerId": player_id, "displayName": live.display_name, "text": text, "messageId": str(uuid.uuid4()), "serverTime": time.time()})
            elif message_type == "ping":
                await websocket.send_json({"type": "pong", "serverTime": time.time()})
    except WebSocketDisconnect:
        pass
    finally:
        removed_current = False
        async with region_locks[region_id]:
            if regions[region_id].get(player_id) is live:
                regions[region_id].pop(player_id, None)
                removed_current = True
        if removed_current:
            save_profile(live, region_id)
            await broadcast(region_id, {"type": "presence", "action": "leave", "playerId": player_id, "displayName": live.display_name})


# ---------------------------------------------------------------------------
# OPTIONAL AUTH INTEGRATION (non-breaking).
# When STH_REQUIRE_AUTH_TICKET=true, the existing open /ws/{region_id} endpoint
# additionally requires a short-lived WebSocket ticket issued by the auth backend
# (discord-bot-sth/server-python). This lets the world host enforce Discord
# membership without changing its internal movement logic. When the env var is
# unset/false, behaviour is identical to before (local play still works).
# ---------------------------------------------------------------------------
import os as _os

if _os.getenv("STH_REQUIRE_AUTH_TICKET", "false").lower() in ("1", "true", "yes"):
    try:
        import sys as _sys
        _AUTH_PATH = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)),
                                    "..", "discord-bot-sth", "server-python")
        if _AUTH_PATH not in _sys.path:
            _sys.path.insert(0, _AUTH_PATH)
        from services.websocket_service import consume_ticket as _consume_ticket  # noqa: F401
        from database import SessionLocal as _SessionLocal  # noqa: F401
        _AUTH_TICKET_ENABLED = True
    except Exception as _exc:  # pragma: no cover
        print(f"[world] auth ticket enforcement disabled: {_exc}")
        _AUTH_TICKET_ENABLED = False
else:
    _AUTH_TICKET_ENABLED = False


async def _maybe_enforce_ticket(websocket, region_id, ticket: str):
    """If auth tickets are enabled, validate + consume the ticket before letting
    the player into the region. Returns True if allowed to proceed."""
    if not _AUTH_TICKET_ENABLED:
        return True
    db = _SessionLocal()
    try:
        _consume_ticket(db, ticket)
        return True
    except Exception as _e:
        await websocket.send_json({"type": "auth_failed", "reason": str(_e)})
        await websocket.close(code=4401)
        return False
    finally:
        try:
            db.close()
        except Exception:
            pass
