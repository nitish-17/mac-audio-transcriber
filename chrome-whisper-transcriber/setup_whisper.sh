#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
WHISPER_DIR="$PROJECT_DIR/whisper.cpp"
MODEL_NAME="large-v3-turbo"
MODEL_PATH="$WHISPER_DIR/models/ggml-$MODEL_NAME.bin"

echo "=== 1. Cloning / Updating whisper.cpp ==="
if [ ! -d "$WHISPER_DIR" ]; then
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
else
    echo "whisper.cpp directory already exists."
fi

echo "=== 2. Building whisper.cpp with Metal GPU Acceleration ==="
cd "$WHISPER_DIR"
cmake -B build -DGGML_METAL=ON
cmake --build build --config Release -j

echo "=== 3. Downloading Whisper Model ($MODEL_NAME) ==="
if [ ! -f "$MODEL_PATH" ]; then
    bash ./models/download-ggml-model.sh "$MODEL_NAME"
else
    echo "Model $MODEL_NAME already exists at $MODEL_PATH."
fi

echo "=== Setup Complete! ==="
echo "whisper-cli binary: $WHISPER_DIR/build/bin/whisper-cli"
echo "model path: $MODEL_PATH"
