from __future__ import annotations

import os
from pathlib import Path

import uvicorn

BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)

from world_server import app  # noqa: E402


def main() -> None:
    host = os.getenv("WORLD_HOST", "0.0.0.0")
    port = int(os.getenv("WORLD_PORT", "7076"))
    cert_file = os.getenv("SSL_CERTFILE", "").strip()
    key_file = os.getenv("SSL_KEYFILE", "").strip()

    ssl_args = {}
    if cert_file and key_file:
        ssl_args = {
            "ssl_certfile": str(Path(cert_file).expanduser()),
            "ssl_keyfile": str(Path(key_file).expanduser()),
        }

    print(f"SubwayThotsHotel Online world starting on {host}:{port}")
    print(f"Health check: {'https' if ssl_args else 'http'}://147.189.172.104:{port}/health")
    uvicorn.run(
        app,
        host=host,
        port=port,
        proxy_headers=True,
        forwarded_allow_ips="*",
        **ssl_args,
    )


if __name__ == "__main__":
    main()
