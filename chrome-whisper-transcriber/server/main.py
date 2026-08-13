import os
import sys
import asyncio
import websockets
from transcriber import Transcriber

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "127.0.0.1"
PORT = 8000

transcriber = Transcriber(project_dir=PROJECT_DIR)

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
    print("==================================================")
    
    async with websockets.serve(handle_websocket, HOST, PORT):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer shut down by user.")
