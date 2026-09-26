#!/usr/bin/env python3
"""Garmin Connect bridge for the Planner backend.

    bridge.py status                 -> is a token file present and accepted?
    bridge.py login                  -> sign in with GARMIN_EMAIL / GARMIN_PASSWORD; if Garmin
                                        asks for an MFA code, prints {"event":"needs_mfa"} and
                                        reads the code from stdin
    bridge.py logout                 -> delete the token file
    bridge.py call '<json>'          -> {"calls":[{"key":..,"name":..,"kwargs":{..}}]} runs each
                                        registry method and returns every result

Every line on stdout is one JSON object; the last one carries "done": true. Errors inside a
call never abort the batch: they land in that call's result as {"ok": false, "error", "code"}.
Environment: GARMIN_EMAIL, GARMIN_PASSWORD, GARMIN_TOKENSTORE (directory for garmin_tokens.json).
"""
import json
import logging
import os
import sys
from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectNotFoundError,
    GarminConnectTooManyRequestsError,
)

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

HERE = Path(__file__).resolve().parent
REGISTRY = {e["name"]: e for e in json.loads((HERE / "registry.json").read_text())}
TOKENSTORE = os.environ.get("GARMIN_TOKENSTORE") or str(HERE.parent / "garmin-state")
EMAIL = os.environ.get("GARMIN_EMAIL") or None
PASSWORD = os.environ.get("GARMIN_PASSWORD") or None
MFA_TIMEOUT_S = 300


class MfaRequired(Exception):
    """Raised on non-interactive commands when Garmin wants a code."""


def emit(obj):
    sys.stdout.write(json.dumps(obj, default=str) + "\n")
    sys.stdout.flush()


def error_code(exc):
    if isinstance(exc, MfaRequired):
        return "mfa_required"
    if isinstance(exc, GarminConnectTooManyRequestsError):
        return "rate_limited"
    if isinstance(exc, GarminConnectAuthenticationError):
        return "auth"
    if isinstance(exc, GarminConnectNotFoundError):
        return "not_found"
    if isinstance(exc, GarminConnectConnectionError):
        return "connection"
    return "garmin"


def token_file():
    return Path(TOKENSTORE).expanduser() / "garmin_tokens.json"


def profile_of(api):
    prof = getattr(api, "profile", None) or {}
    return {
        "display_name": getattr(api, "display_name", None) or prof.get("displayName"),
        "full_name": getattr(api, "full_name", None) or prof.get("fullName"),
        "unit_system": getattr(api, "unit_system", None),
        "profile_id": prof.get("profileId"),
        "user_profile_number": prof.get("userProfileNumber") or prof.get("profileId"),
    }


def mfa_from_stdin():
    """prompt_mfa callback for `login`: tell Node, then wait for the code."""
    emit({"event": "needs_mfa"})
    import select
    ready, _, _ = select.select([sys.stdin], [], [], MFA_TIMEOUT_S)
    if not ready:
        raise GarminConnectAuthenticationError("Timed out waiting for the MFA code")
    code = sys.stdin.readline().strip()
    if not code:
        raise GarminConnectAuthenticationError("Empty MFA code")
    return code


def mfa_refuse():
    raise MfaRequired("Garmin asked for an MFA code; sign in from Settings")


def connect(with_credentials, prompt_mfa):
    """Build a client. Cached tokens are tried first; credentials only when allowed."""
    Path(TOKENSTORE).expanduser().mkdir(mode=0o700, parents=True, exist_ok=True)
    if with_credentials:
        api = Garmin(EMAIL, PASSWORD, prompt_mfa=prompt_mfa)
    else:
        api = Garmin()
    api.login(TOKENSTORE)
    return api


def cmd_status():
    present = token_file().exists()
    if not present:
        return {"done": True, "connected": False, "token_file": False, "configured": bool(EMAIL and PASSWORD)}
    try:
        api = connect(with_credentials=False, prompt_mfa=None)
        return {"done": True, "connected": True, "token_file": True,
                "configured": bool(EMAIL and PASSWORD), "profile": profile_of(api)}
    except Exception as exc:  # token present but rejected / offline
        return {"done": True, "connected": False, "token_file": True,
                "configured": bool(EMAIL and PASSWORD), "error": str(exc), "code": error_code(exc)}


def cmd_login():
    if not (EMAIL and PASSWORD):
        return {"done": True, "ok": False, "code": "not_configured",
                "error": "GARMIN_EMAIL and GARMIN_PASSWORD are not set in backend/.env"}
    try:
        api = connect(with_credentials=True, prompt_mfa=mfa_from_stdin)
        if not token_file().exists():
            # login() dumps only on a credential login; a token-only login has it already.
            api.client.dump(TOKENSTORE)
        return {"done": True, "ok": True, "profile": profile_of(api)}
    except Exception as exc:
        return {"done": True, "ok": False, "error": str(exc), "code": error_code(exc)}


def cmd_logout():
    tf = token_file()
    existed = tf.exists()
    if existed:
        tf.unlink()
    return {"done": True, "ok": True, "removed": existed}


def cmd_call(payload):
    calls = payload.get("calls") or []
    results = {}
    try:
        api = connect(with_credentials=bool(EMAIL and PASSWORD), prompt_mfa=mfa_refuse)
    except Exception as exc:
        return {"done": True, "ok": False, "error": str(exc), "code": error_code(exc), "results": results}
    for c in calls:
        key = c.get("key") or c.get("name")
        name = c.get("name")
        kwargs = c.get("kwargs") or {}
        entry = REGISTRY.get(name)
        if not entry or entry["kind"] == "unsupported":
            results[key] = {"ok": False, "error": f"unknown or unsupported endpoint: {name}", "code": "bad_request"}
            continue
        try:
            data = getattr(api, name)(**kwargs)
            results[key] = {"ok": True, "data": data}
        except Exception as exc:
            results[key] = {"ok": False, "error": str(exc), "code": error_code(exc)}
    return {"done": True, "ok": True, "results": results}


def main(argv):
    if len(argv) < 2:
        emit({"done": True, "ok": False, "error": "usage: bridge.py status|login|logout|call <json>"})
        return 2
    cmd = argv[1]
    payload = json.loads(argv[2]) if len(argv) > 2 else {}
    if cmd == "status":
        out = cmd_status()
    elif cmd == "login":
        out = cmd_login()
    elif cmd == "logout":
        out = cmd_logout()
    elif cmd == "call":
        out = cmd_call(payload)
    else:
        out = {"done": True, "ok": False, "error": f"unknown command {cmd}"}
    emit(out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
