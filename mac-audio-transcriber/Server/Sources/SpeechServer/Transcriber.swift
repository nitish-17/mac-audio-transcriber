import Foundation
import Speech
import AVFoundation

class Transcriber {
    private let speechRecognizer = SFSpeechRecognizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var isAuthorized = false
    private var isActive = false
    private var consecutiveFailures = 0
    private let maxConsecutiveFailures = 3

    private var currentPartial = ""   // Latest partial text from recognizer (can shrink on reset)
    private var sessionCount = 0

    private let fileURL: URL

    var onTranscript: ((String) -> Void)?

    init() {
        let currentDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        fileURL = currentDir.appendingPathComponent("transcript.txt")
        print("Transcript file: \(fileURL.path)")
    }

    func requestAuthorization() {
        print("Requesting Speech Recognition authorization...")
        let semaphore = DispatchSemaphore(value: 0)

        SFSpeechRecognizer.requestAuthorization { authStatus in
            switch authStatus {
            case .authorized:
                print("Speech Recognition Authorized!")
                self.isAuthorized = true
            case .denied:
                print("ERROR: Enable Speech Recognition in System Settings > Privacy & Security > Speech Recognition.")
            case .restricted:
                print("ERROR: Speech Recognition is restricted on this device.")
            case .notDetermined:
                print("ERROR: Speech Recognition authorization not determined.")
            @unknown default:
                print("ERROR: Unknown authorization status.")
            }
            semaphore.signal()
        }
        semaphore.wait()

        if let recognizer = speechRecognizer {
            print("Using locale: \(recognizer.locale.identifier)")
        }
    }

    // MARK: - Public API

    func startSession() {
        guard isAuthorized else {
            print("Cannot start — not authorized.")
            return
        }

        // Finalize any existing session first
        finalizeCurrentSession()

        isActive = true
        sessionCount = 0
        consecutiveFailures = 0

        appendToFile("\n--- Recording started: \(Date()) ---")
        startRecognitionTask()
    }

    func processAudio(data: Data) {
        guard let recognitionRequest = recognitionRequest else { return }

        let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1, interleaved: false)!
        let frameCount = AVAudioFrameCount(data.count / MemoryLayout<Float>.size)
        guard frameCount > 0 else { return }

        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount

        data.withUnsafeBytes { rawBufferPointer in
            if let ptr = rawBufferPointer.bindMemory(to: Float.self).baseAddress {
                buffer.floatChannelData?[0].update(from: ptr, count: Int(frameCount))
            }
        }

        recognitionRequest.append(buffer)
    }

    func stop() {
        guard isActive else { return }
        print("Stopping transcription...")
        isActive = false
        finalizeCurrentSession()
        appendToFile("--- Recording stopped: \(Date()) ---")
        print("Transcript saved.")
    }

    // MARK: - Internal

    private func finalizeCurrentSession() {
        if !currentPartial.isEmpty {
            appendToFile(currentPartial)
            currentPartial = ""
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
    }

    private func startRecognitionTask() {
        guard isActive else { return }

        recognitionRequest = nil
        recognitionTask = nil
        currentPartial = ""

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else { return }

        recognitionRequest.shouldReportPartialResults = true
        if #available(macOS 13, *) {
            recognitionRequest.requiresOnDeviceRecognition = true
        }

        guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
            print("ERROR: Speech recognizer not available.")
            return
        }

        sessionCount += 1

        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let newText = result.bestTranscription.formattedString

                // Detect Apple's internal text reset:
                // If the new text is dramatically shorter than what we had,
                // the recognizer has internally restarted its accumulation.
                // Save the old text before it's lost.
                if self.currentPartial.count > 30 && newText.count < self.currentPartial.count / 2 {
                    print("Reset detected — saving previous chunk (\(self.currentPartial.count) chars)")
                    self.appendToFile(self.currentPartial)
                }

                self.currentPartial = newText
                self.onTranscript?(newText)
                self.consecutiveFailures = 0

                if result.isFinal {
                    self.appendToFile(self.currentPartial)
                    self.currentPartial = ""
                }
            }

            if let error = error {
                let nsError = error as NSError
                if nsError.code == 216 { return } // We canceled it ourselves

                print("Session #\(self.sessionCount) ended: \(error.localizedDescription)")

                // Save whatever we have
                if !self.currentPartial.isEmpty {
                    self.appendToFile(self.currentPartial)
                    self.currentPartial = ""
                }

                guard self.isActive else { return }

                self.consecutiveFailures += 1
                if self.consecutiveFailures >= self.maxConsecutiveFailures {
                    print("Too many failures in a row. Pausing auto-restart.")
                    self.consecutiveFailures = 0
                    return
                }

                let delay = Double(self.consecutiveFailures) * 1.0
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    guard self.isActive else { return }
                    self.startRecognitionTask()
                }
            }
        }

        print("Session #\(sessionCount) started.")
    }

    /// Append-only write. Opens the file fresh each time to guarantee append.
    private func appendToFile(_ text: String) {
        guard !text.isEmpty else { return }
        let line = text + "\n"
        guard let data = line.data(using: .utf8) else { return }

        // Create file if needed
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
        }

        // Open, seek to end, write, close — bulletproof append
        if let handle = try? FileHandle(forWritingTo: fileURL) {
            _ = try? handle.seekToEnd()
            handle.write(data)
            try? handle.synchronize()
            handle.closeFile()
        }

        let preview = text.prefix(80)
        print("✓ Saved: \"\(preview)\(text.count > 80 ? "..." : "")\" (\(text.count) chars)")
    }
}
