// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SpeechServer",
    platforms: [
        .macOS(.v14) // Lowest compatible version for Network framework, though actual transcription needs 26+
    ],
    targets: [
        .executableTarget(
            name: "SpeechServer",
            dependencies: [])
    ]
)
