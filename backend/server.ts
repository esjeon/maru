import { readFile } from "node:fs/promises";
import * as http from "node:http";
import { join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";

import * as signaling from "../shared/signaling";
import { NodeWebSocketAdapter } from "./NodeWebSocketAdaptor";

const MAIN_HTML_PATH = "../static/main.html";

function parseRequestURL(req: http.IncomingMessage): URL {
  const baseUrl = `http://${req.headers.host}`;

  if (!req.url) return new URL(baseUrl);
  return new URL(req.url, baseUrl);
}

class SignalingChannel extends signaling.GenericChannel<
  signaling.ClientMessage,
  signaling.ServerMessage
> {
  constructor(
    public readonly id: string,
    ws: WebSocket,
  ) {
    super(new NodeWebSocketAdapter(ws), signaling.isClientMessage);
  }
}

class SignalingServer {
  public wsServer: WebSocketServer;
  public channels: Map<string, SignalingChannel>;

  constructor(server: AppServer) {
    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", this.acceptConnection.bind(this));

    this.channels = new Map();
  }

  private acceptConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const url = parseRequestURL(req);

    // URL pathname must be right
    if (url.pathname !== "/signaling") {
      throw new Error("Endpoint not found");
    }

    // ID must be provided
    const chanId = url.searchParams.get("id");
    if (!chanId) {
      throw new Error("Missing ID");
    }

    // ID must NOT be already in used
    if (this.channels.has(chanId)) {
      throw new Error("Duplicated ID");
    }

    // Create and register the channel
    const chan = new SignalingChannel(chanId, ws);
    this.channels.set(chan.id, chan);

    console.info(`client connected: ${chan.id}`);

    //
    // Register evnet/message handlers.
    //

    // Clean up on disconnect
    chan.addEventListener("close", () => {
      // Unregister the channel
      this.channels.delete(chanId);

      // Announce the removal of the peer
      this.broadcast({ delPeer: chanId }, chanId);
    });

    // Relay `rtc` messages between peers
    chan.addMessageHandler("rtc", (ev) => {
      const rtc = ev.detail;

      // Overwrite the sender information (we know who's sending it.)
      rtc.from = chan.id;

      // Send the message to the recipient
      const destChannel = this.channels.get(rtc.to);
      if (!destChannel) {
        throw new Error("Recipient not found");
      }
      destChannel.sendMessage({ rtc });
    });

    // Send the new peer the current list of peers.
    chan.sendMessage({
      peers: Array.from(this.channels.keys()),
    });

    // Announce the joining of a new peer
    this.broadcast({ addPeer: chan.id }, chan.id);
  }

  private broadcast(msg: signaling.ServerMessage, exceptId?: string): void {
    for (const [id, chan] of this.channels) {
      if (id === exceptId) continue;
      chan.sendMessage(msg);
    }
  }
}

async function serveMainPage(
  req: http.IncomingMessage,
  resp: http.ServerResponse,
): Promise<void> {
  if (req.method === "GET") {
    const html = await readFile(join(import.meta.dirname, MAIN_HTML_PATH));
    resp.writeHead(200, { "Content-Type": "text/html" }).end(html);
  } else {
    resp.writeHead(405, { "Content-Type": "text/plain" });
    resp.end("Method Not Allowed");
  }
}

export class AppServer {
  public httpServer: http.Server;
  public signalingServer: SignalingServer;

  constructor() {
    this.httpServer = new http.Server((req, resp) => this.onRequest(req, resp));
    this.signalingServer = new SignalingServer(this);
  }

  private async onRequest(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
  ): Promise<void> {
    try {
      if (req.url === "/") return serveMainPage(req, resp);

      resp.writeHead(404, { "Content-Type": "text/plain" });
      resp.end("Not Found");
    } catch (e) {
      console.error(e);
      resp.writeHead(500, { "Content-Type": "text/plain" });
      resp.end("Interal Server Error");
    }
  }
}
