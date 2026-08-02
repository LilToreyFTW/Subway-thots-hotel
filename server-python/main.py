from __future__ import annotations

import asyncio
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
from sqlalchemy import Float, Integer, String, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

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


class GamertagRegistry(Base):
    __tablename__ = "gamertag_registry"
    tag: Mapped[str] = mapped_column(String(40), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(16), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)


@dataclass
class LivePlayer:
    player_id: str
    display_name: str
    websocket: WebSocket
    x: float = 0.0
    y: float = 0.0
    z: float = 8.0
    dx: float = 0.0
    dz: float = 0.0
    last_input: float = field(default_factory=time.monotonic)


regions: dict[str, dict[str, LivePlayer]] = defaultdict(dict)
region_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def load_profile(player_id: str, display_name: str, region_id: str) -> LivePlayer | None:
    with SessionLocal() as db:
        profile = db.get(PlayerProfile, player_id)
        if profile is None:
            profile = PlayerProfile(player_id=player_id, display_name=display_name[:80], region_id=region_id)
            db.add(profile)
            db.commit()
        else:
            profile.display_name = display_name[:80] or profile.display_name
            profile.region_id = region_id
            db.commit()
        return LivePlayer(player_id=profile.player_id, display_name=profile.display_name, websocket=None, x=profile.x, y=profile.y, z=profile.z)


def save_profile(player: LivePlayer, region_id: str) -> None:
    with SessionLocal() as db:
        profile = db.get(PlayerProfile, player.player_id)
        if profile is None:
            profile = PlayerProfile(player_id=player.player_id)
            db.add(profile)
        profile.display_name = player.display_name
        profile.x, profile.y, profile.z, profile.region_id = player.x, player.y, player.z, region_id
        db.commit()


def snapshot(region_id: str) -> dict[str, Any]:
    return {
        "type": "snapshot",
        "regionId": region_id,
        "serverTime": time.time(),
        "players": [
            {"id": p.player_id, "displayName": p.display_name, "position": {"x": round(p.x, 3), "y": round(p.y, 3), "z": round(p.z, 3)}}
            for p in regions[region_id].values()
        ],
    }


async def broadcast(region_id: str, payload: dict[str, Any]) -> None:
    stale: list[str] = []
    for player_id, player in list(regions[region_id].items()):
        try:
            await player.websocket.send_json(payload)
        except Exception:
            stale.append(player_id)
    for player_id in stale:
        regions[region_id].pop(player_id, None)


async def region_loop(region_id: str) -> None:
    step = 1.0 / TICK_RATE
    while True:
        started = time.monotonic()
        async with region_locks[region_id]:
            for player in list(regions[region_id].values()):
                player.x = max(-38.0, min(38.0, player.x + player.dx * step * 6.0))
                player.z = max(-38.0, min(38.0, player.z + player.dz * step * 6.0))
                if time.monotonic() - player.last_input > 0.75:
                    player.dx = player.dz = 0.0
            if regions[region_id]:
                await broadcast(region_id, snapshot(region_id))
        await asyncio.sleep(max(0.0, step - (time.monotonic() - started)))


region_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
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
async def region_socket(websocket: WebSocket, region_id: str, player_id: str = Query(default=""), display_name: str = Query(default="Guest")):
    await websocket.accept()
    player_id = (player_id or str(uuid.uuid4()))[:80]
    live = load_profile(player_id, display_name, region_id)
    live.websocket = websocket
    async with region_locks[region_id]:
        regions[region_id][player_id] = live
        if region_id not in region_tasks or region_tasks[region_id].done():
            region_tasks[region_id] = asyncio.create_task(region_loop(region_id))
    await websocket.send_json({"type": "welcome", "playerId": player_id, "regionId": region_id, "serverTickRate": TICK_RATE})
    await broadcast(region_id, {"type": "presence", "action": "join", "playerId": player_id, "displayName": live.display_name})
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            if message_type == "input":
                live.dx = max(-1.0, min(1.0, float(message.get("x", 0.0))))
                live.dz = max(-1.0, min(1.0, float(message.get("z", 0.0))))
                live.last_input = time.monotonic()
            elif message_type == "chat":
                text = str(message.get("text", "")).strip()[:240]
                if text:
                    await broadcast(region_id, {"type": "chat", "playerId": player_id, "displayName": live.display_name, "text": text})
            elif message_type == "ping":
                await websocket.send_json({"type": "pong", "serverTime": time.time()})
    except WebSocketDisconnect:
        pass
    finally:
        async with region_locks[region_id]:
            regions[region_id].pop(player_id, None)
        save_profile(live, region_id)
        await broadcast(region_id, {"type": "presence", "action": "leave", "playerId": player_id, "displayName": live.display_name})
