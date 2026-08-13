#!/bin/bash
set -e

SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SERVER_DIR/venv/bin/python3"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Creating python virtual environment..."
    python3 -m venv "$SERVER_DIR/venv"
    "$VENV_PYTHON" -m pip install -r "$SERVER_DIR/requirements.txt"
fi

echo "Starting Whisper WebSocket Server on ws://127.0.0.1:8000..."
exec "$VENV_PYTHON" "$SERVER_DIR/main.py"
