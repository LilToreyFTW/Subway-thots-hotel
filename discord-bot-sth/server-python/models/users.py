"""SQLAlchemy ORM models for the Subway-Thots-Hotel auth system.

Field notes (see spec):
- The Discord user id is the permanent identity key, NEVER the username.
- game_profiles holds the public in-game name + 6-digit number + full tag.
- Uniqueness constraints enforce one account per Discord id, one game tag,
  unique normalized name, unique name number, single active OAuth state and
  WebSocket ticket.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    BANNED = "banned"
    DELETED = "deleted"
    MEMBERSHIP_MISSING = "discord_membership_missing"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_status: Mapped[str] = mapped_column(String(32), default=AccountStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    discord: Mapped["DiscordAccount | None"] = relationship(
        "DiscordAccount", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    profile: Mapped["GameProfile | None"] = relationship(
        "GameProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    roles: Mapped[list["AccountRole"]] = relationship(
        "AccountRole", back_populates="user", cascade="all, delete-orphan"
    )
    bans: Mapped[list["Ban"]] = relationship("Ban", back_populates="user", cascade="all, delete-orphan")
    suspensions: Mapped[list["Suspension"]] = relationship(
        "Suspension", back_populates="user", cascade="all, delete-orphan"
    )
    notes: Mapped[list["ModerationNote"]] = relationship(
        "ModerationNote", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_active(self) -> bool:
        return self.account_status == AccountStatus.ACTIVE.value


class DiscordAccount(Base):
    __tablename__ = "discord_accounts"
    __table_args__ = (UniqueConstraint("discord_user_id", name="uq_discord_user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discord_user_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    discord_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discord_global_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Avatar hash only (never the full URL with token). Reconstructed on demand.
    discord_avatar_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    guild_member: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="discord")


class GameProfile(Base):
    __tablename__ = "game_profiles"
    __table_args__ = (
        UniqueConstraint("normalized_display_name", name="uq_normalized_display_name"),
        UniqueConstraint("full_game_tag", name="uq_full_game_tag"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(16), nullable=False)
    normalized_display_name: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    name_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    full_game_tag: Mapped[str] = mapped_column(String(23), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="profile")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Opaque random session token (stored hashed). The raw token lives only in
    # the HttpOnly cookie.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)  # hashed for privacy

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class WebSocketTicket(Base):
    __tablename__ = "websocket_tickets"
    __table_args__ = (UniqueConstraint("ticket_id", name="uq_ws_ticket_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    game_tag: Mapped[str] = mapped_column(String(23), nullable=False)
    discord_id: Mapped[str] = mapped_column(String(32), nullable=False)
    permissions: Mapped[str] = mapped_column(String(64), default="player")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class DiscordMembershipCache(Base):
    __tablename__ = "discord_membership_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    discord_user_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    is_member: Mapped[bool] = mapped_column(Boolean, default=False)
    role_ids: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    permission: Mapped[str] = mapped_column(String(16), default="guest")
    cached_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)


class OAuthState(Base):
    __tablename__ = "oauth_states"
    __table_args__ = (UniqueConstraint("state", name="uq_oauth_state"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    pkce_verifier: Mapped[str | None] = mapped_column(String(128), nullable=True)  # PKCE
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class RoleMapping(Base):
    __tablename__ = "role_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    discord_role_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    game_permission: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str | None] = mapped_column(String(128), nullable=True)


class AccountRole(Base):
    __tablename__ = "account_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discord_role_id: Mapped[str] = mapped_column(String(32), nullable=False)
    game_permission: Mapped[str] = mapped_column(String(16), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    source: Mapped[str] = mapped_column(String(16), default="discord")  # discord | manual

    user: Mapped["User"] = relationship("User", back_populates="roles")


class Ban(Base):
    __tablename__ = "bans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    moderator_discord_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # null = permanent
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    discord_role_applied: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="bans")


class Suspension(Base):
    __tablename__ = "suspensions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    moderator_discord_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship("User", back_populates="suspensions")


class RenameHistory(Base):
    __tablename__ = "rename_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    previous_display_name: Mapped[str | None] = mapped_column(String(16), nullable=True)
    previous_full_game_tag: Mapped[str | None] = mapped_column(String(23), nullable=True)
    new_display_name: Mapped[str] = mapped_column(String(16), nullable=False)
    new_full_game_tag: Mapped[str] = mapped_column(String(23), nullable=False)
    changed_by_discord_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)


class ModerationNote(Base):
    __tablename__ = "moderation_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_discord_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="notes")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    user_account_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    discord_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    acting_staff_discord_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow, index=True)
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class LoginHistory(Base):
    __tablename__ = "login_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)  # success | failure
    reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
