from __future__ import annotations

import os
import logging
from typing import Optional

import jwt
from fastapi import HTTPException, Security, Cookie, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

DJANGO_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"


def _decode_token(token: str) -> dict:
    """Decode and validate a Django SimpleJWT access token."""
    if not DJANGO_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="DJANGO_SECRET_KEY not configured on orchestrator.",
        )
    try:
        payload = jwt.decode(
            token,
            DJANGO_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    token_access: Optional[str] = Cookie(default=None),
    token_query: Optional[str] = Query(default=None, alias="token"),
) -> dict:
    """
    Validate JWT from either:
      - Authorization: Bearer <token> header
      - token_access httponly cookie set by Django on login

    Returns decoded JWT payload containing user_id.
    Raises 401 if token is missing, expired, or invalid.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif token_access:
        token = token_access
    elif token_query:
        token = token_query

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Provide a Bearer token or log in via Django.",
        )

    payload = _decode_token(token)

    # SimpleJWT sets token_type = "access" — reject refresh tokens
    if payload.get("token_type") != "access":
        raise HTTPException(
            status_code=401,
            detail="Invalid token type. Use an access token.",
        )

    return payload


def get_user_id(user: dict) -> str:
    """Extract user ID string from JWT payload."""
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user_id.")
    return str(user_id)
