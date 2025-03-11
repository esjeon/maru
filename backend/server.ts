import { readFile } from "node:fs/promises";
import * as http from "node:http";
import { join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";

import * as signaling from "../shared/signaling";
import { NodeWebSocketAdapter } from "./NodeWebSocketAdaptor";

const MAIN_HTML_PATH = "../static/main.html";

function parseRequestURL(req: http.IncomingMessage): URL {
  const protocol = "http"; //req.socket.encrypted ? 'https' : 'http';
  const baseUrl = `${protocol}://${req.headers.host}`;

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
  public signalingChannels: Map<string, SignalingChannel>;

  constructor(server: AppServer) {
    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.signalingChannels = new Map();
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const url = parseRequestURL(req);
    const id = url.searchParams.get("id");
    if (url.pathname !== "/signaling" || !id) {
      console.info("SignalingServer connection rejected: invalid request", req);
      return ws.close();
    }

    if (this.signalingChannels.has(id)) {
      console.info("SignalingServer connection rejected: duplicated ID", req);
      return ws.close();
    }

    const signalingChannel = new SignalingChannel(id, ws);
    this.signalingChannels.set(signalingChannel.id!, signalingChannel);
    this.registerChannelMessageHandler(signalingChannel);

    console.info(`client connected: ${signalingChannel.id}`);

    signalingChannel.addEventListener("close", () => {
      this.signalingChannels.delete(signalingChannel.id!);
      this.broadcast({ delPeer: signalingChannel.id! }, signalingChannel.id!);
    });

    // Send the welcome message.
    signalingChannel.sendMessage({
      peers: Array.from(this.signalingChannels.keys()),
    });

    // Tell others about the new peer.
    this.broadcast({ addPeer: signalingChannel.id! }, signalingChannel.id!);
  }

  private registerChannelMessageHandler(
    signalingChannel: SignalingChannel,
  ): void {
    signalingChannel.addMessageHandler("rtc", (ev) => {
      const rtc = ev.detail;
      if (signalingChannel.id !== rtc.from) {
        return console.warn(
          "ChannelServer ignored message with invalid sender",
          rtc,
        );
      }

      const destChannel = this.signalingChannels.get(rtc.to);
      if (!destChannel) {
        return console.warn(
          "ChannelServer ignored message with invalid recipient",
          rtc,
        );
      }

      destChannel.sendMessage({ rtc });
    });
  }

  private broadcast(msg: signaling.ServerMessage, exceptId?: string): void {
    for (const [id, conn] of this.signalingChannels) {
      if (id == exceptId) continue;
      conn.sendMessage(msg);
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
