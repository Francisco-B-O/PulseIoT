import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from api import auth

SECRET = b"unit-test-secret-key-at-least-32-bytes!!"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_token(claims: dict, secret: bytes = SECRET, alg: str = "HS256") -> str:
    header = _b64(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    payload = _b64(json.dumps(claims).encode())
    sig = _b64(hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture
def secured(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", base64.b64encode(SECRET).decode())


def test_decode_valid_token():
    claims = auth.decode_token(make_token({"sub": "admin", "exp": time.time() + 60}), SECRET)
    assert claims["sub"] == "admin"


@pytest.mark.parametrize("token", [
    make_token({"sub": "x", "exp": time.time() - 5}),          # expired
    make_token({"sub": "x"}, secret=b"another-secret-another-secret-12345"),  # bad signature
    make_token({"sub": "x"}, alg="none"),                      # unsupported alg
    "not.a.jwt",
    "garbage",
])
def test_decode_rejects_invalid_tokens(token):
    with pytest.raises(ValueError):
        auth.decode_token(token, SECRET)


def test_open_when_secret_not_configured(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert auth.require_admin(None) is None
    assert auth.require_user(None) is None


def test_missing_token_is_401(secured):
    with pytest.raises(HTTPException) as e:
        auth.require_user(None)
    assert e.value.status_code == 401


def test_user_token_accepted_but_not_admin(secured):
    token = make_token({"sub": "bob", "roles": ["ROLE_USER"], "exp": time.time() + 60})
    assert auth.require_user(creds(token))["sub"] == "bob"
    with pytest.raises(HTTPException) as e:
        auth.require_admin(creds(token))
    assert e.value.status_code == 403


def test_admin_token_accepted(secured):
    token = make_token({"sub": "admin", "roles": ["ROLE_ADMIN"], "exp": time.time() + 60})
    assert auth.require_admin(creds(token))["sub"] == "admin"
