import Foundation
import Network

class WebSocketServer {
    private let listener: NWListener
    private var activeConnection: NWConnection?
    private var packetCount = 0
    private var isRemoved = false

    var onClientConnected: (() -> Void)?
    var onDataReceived: ((Data) -> Void)?
    var onClientDisconnected: (() -> Void)?

    init(port: UInt16) throws {
        let parameters = NWParameters.tcp
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

        let nwPort = NWEndpoint.Port(rawValue: port)!
        listener = try NWListener(using: parameters, on: nwPort)
    }

    func start() {
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if let port = self.listener.port {
                    print("WebSocket Server listening on ws://localhost:\(port.rawValue)")
                }
            case .failed(let error):
                print("Listener failed: \(error)")
            default:
                break
            }
        }

        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { return }
            print("New client connected")

            // If there's an existing connection, close it first
            if let old = self.activeConnection {
                print("Closing previous connection")
                old.cancel()
                self.onClientDisconnected?()
            }

            self.activeConnection = connection
            self.packetCount = 0
            self.isRemoved = false

            connection.stateUpdateHandler = { [weak self] state in
                guard let self = self, self.activeConnection === connection else { return }
                switch state {
                case .ready:
                    print("Connection ready")
                    self.receive(on: connection)
                    self.onClientConnected?()
                case .failed, .cancelled:
                    if !self.isRemoved {
                        self.isRemoved = true
                        self.activeConnection = nil
                        self.onClientDisconnected?()
                    }
                default:
                    break
                }
            }
            connection.start(queue: .global())
        }

        listener.start(queue: .global())
    }

    func send(text: String) {
        guard let connection = activeConnection else { return }
        guard let data = text.data(using: .utf8) else { return }

        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "text", metadata: [metadata])
        connection.send(content: data, contentContext: context, isComplete: true,
                        completion: .contentProcessed({ _ in }))
    }

    private func receive(on connection: NWConnection) {
        connection.receiveMessage { [weak self] content, context, isComplete, error in
            guard let self = self, self.activeConnection === connection else { return }

            if let error = error {
                if !self.isRemoved {
                    self.isRemoved = true
                    self.activeConnection = nil
                    connection.cancel()
                    self.onClientDisconnected?()
                }
                return
            }

            if let data = content, !data.isEmpty {
                self.packetCount += 1
                if self.packetCount == 1 || self.packetCount % 100 == 0 {
                    print("Packets received: \(self.packetCount) (\(data.count) bytes each)")
                }
                self.onDataReceived?(data)
                self.receive(on: connection)
            } else if content == nil || content!.isEmpty {
                print("Client disconnected")
                if !self.isRemoved {
                    self.isRemoved = true
                    self.activeConnection = nil
                    connection.cancel()
                    self.onClientDisconnected?()
                }
            }
        }
    }
}
