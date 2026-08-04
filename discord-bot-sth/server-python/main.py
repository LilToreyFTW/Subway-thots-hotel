"""Subway-Thots-Hotel authentication + community-management backend.

This FastAPI app hosts:
- Discord OAuth2 login/callback
- account + player-name creation
- membership verification + WebSocket ticket issuance
- admin/moderation REST endpoints
- the authenticated multiplayer WebSocket endpoint

It shares the database with the existing world host (server-python/main.py) so
game accounts and live players live together. The world's own /ws/{region_id}
endpoint (open, token-in-query) is deprecated in favor of this authenticated one;
both can run simultaneously without conflict.

Run:
    uvicorn main:app --host 0.0.0.0 --port 7076
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from config import FRONTEND_URL
from database import init_models


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create all auth tables (idempotent). Safe to run alongside the world host,
    # which creates its own tables on startup.
    try:
        init_models()
    except Exception as exc:  # pragma: no cover - logging only
        print(f"[auth] model init warning: {exc}")
    yield


app = FastAPI(
    title="Subway Thots Hotel — Auth & Community API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: restrict to the configured frontend origin. Allow credentials for cookies.
_allowed = [o.strip() for o in FRONTEND_URL.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed or ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "sth-auth", "version": "1.0.0"}


# Register routers.
from api.auth_routes import router as auth_router
from api.account_routes import router as account_router
from api.player_routes import router as player_router
from api.admin_routes import router as admin_router
from api.ws_routes import router as ws_router

app.include_router(auth_router)
app.include_router(account_router)
app.include_router(player_router)
app.include_router(admin_router)
app.include_router(ws_router)


if __name__ == "__main__":
    import uvicorn

    from config import WORLD_BIND_HOST, WORLD_BIND_PORT

    uvicorn.run("main:app", host=WORLD_BIND_HOST, port=WORLD_BIND_PORT, reload=False)
