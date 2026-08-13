import Foundation
import Network

print("=== Audio Transcriber Server ===")
print("")

// 1. Initialize transcriber and request authorization (blocks until granted)
let transcriber = Transcriber()
transcriber.requestAuthorization()

// 2. Initialize WebSocket server
guard let server = try? WebSocketServer(port: 8080) else {
    print("ERROR: Failed to start WebSocket server on port 8080. Is the port already in use?")
    exit(1)
}

// 3. Wire up callbacks

// When the extension connects, start a new speech recognition session
server.onClientConnected = {
    transcriber.startSession()
}

// When audio data arrives, feed it to the speech recognizer
server.onDataReceived = { data in
    transcriber.processAudio(data: data)
}

// When the extension disconnects, finalize the session
server.onClientDisconnected = {
    transcriber.stop()
    print("Client disconnected. Waiting for next connection...")
}

// When the transcriber produces new text, send it back to the extension
transcriber.onTranscript = { text in
    server.send(text: text)
}

// 4. Start the server
server.start()

print("Waiting for Chrome extension to connect...")
print("")

// Keep the process alive
RunLoop.main.run()
