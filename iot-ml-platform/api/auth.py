"""
Minimal HS256 JWT verification for the ML API.

The tokens are issued by auth-service and signed with the same shared secret the
gateway uses (``JWT_SECRET``, base64-encoded). Verification is done with the
standard library only, so no extra dependency is needed.

If ``JWT_SECRET`` is not set the API runs open (local development and unit tests)
and logs a warning once at import time.
"""
import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
Bearer = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


def _b64url_decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def _secret() -> bytes | None:
    raw = os.getenv("JWT_SECRET")
    if not raw:
        return None
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        return raw.encode()


if _secret() is None:
    logger.warning("JWT_SECRET is not set: ML API endpoints are NOT protected.")


def decode_token(token: str, secret: bytes) -> dict:
    """Return the claims of a valid, unexpired HS256 token or raise ``ValueError``."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":
            raise ValueError("unsupported algorithm")
        expected = hmac.new(secret, f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
            raise ValueError("bad signature")
        claims = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError, binascii.Error) as exc:
        raise ValueError("invalid token") from exc
    if "exp" in claims and float(claims["exp"]) < time.time():
        raise ValueError("token expired")
    return claims


def _authenticate(credentials: HTTPAuthorizationCredentials | None) -> dict | None:
    secret = _secret()
    if secret is None:
        return None  # auth disabled
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        return decode_token(credentials.credentials, secret)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def require_user(credentials: Bearer) -> dict | None:
    """Any authenticated user."""
    return _authenticate(credentials)


def require_admin(credentials: Bearer) -> dict | None:
    """Authenticated user with ``ROLE_ADMIN``."""
    claims = _authenticate(credentials)
    if claims is not None and "ROLE_ADMIN" not in claims.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin role required")
    return claims
