import os
import sys
import json
import asyncio
import websockets
from transcriber import Transcriber

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(PROJECT_DIR, "config.json")

def load_config():
    """Loads configuration settings directly from config.json."""
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Configuration file missing: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

config = load_config()

HOST = "127.0.0.1"
PORT = config.get("port", 8000)

output_filepath = config.get("transcript_path")
model_name = config.get("model_name")
language = config.get("language", "en")

# Override output_filepath via CLI argument or environment variable if passed
if len(sys.argv) > 1 and sys.argv[1].strip():
    output_filepath = sys.argv[1].strip()
elif os.getenv("TRANSCRIPT_PATH"):
    output_filepath = os.getenv("TRANSCRIPT_PATH").strip()

transcriber = Transcriber(
    project_dir=PROJECT_DIR,
    output_path=output_filepath,
    model_name=model_name,
    language=language
)

async def handle_websocket(websocket):
    print(f"[{HOST}:{PORT}] Client connected! Audio streaming started.")
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                transcriber.add_audio_data(message)
            elif isinstance(message, str):
                if message == "STOP":
                    print("Received STOP command from client.")
                    transcriber.flush_remaining()
                    break
    except websockets.exceptions.ConnectionClosedOK:
        print("Client disconnected gracefully.")
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Client connection closed with error: {e}")
    except Exception as e:
        print(f"Unexpected error in websocket handler: {e}")
    finally:
        transcriber.flush_remaining()
        print("Session finalized. Ready for next connection.\n")

async def main():
    print("==================================================")
    print(f" Chrome Whisper Transcriber Server")
    print(f" Listening on: ws://{HOST}:{PORT}")
    print(f" Output File:  {transcriber.transcript_path}")
    print(f" Language:     {transcriber.language}")
    print("==================================================")
    
    async with websockets.serve(handle_websocket, HOST, PORT):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shut down by user.")
