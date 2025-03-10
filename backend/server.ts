import { readFile } from "node:fs/promises";
import * as http from "node:http";
import { join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";

import {
  ClientMessage,
  isClientMessage,
  ServerMessage,
} from "../shared/channel_message.js";
import { GenericChannel } from "../shared/GenericChannel.js";
import { NodeWebSocketAdapter } from "./NodeWebSocketAdaptor.js";

const MAIN_HTML_PATH = "../static/main.html";

function generateRandomID(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

class ServerChannel extends GenericChannel<ClientMessage, ServerMessage> {
  constructor(ws: WebSocket, id?: string) {
    super(new NodeWebSocketAdapter(ws), isClientMessage, id);
  }
}

class ChannelServer {
  public wsServer: WebSocketServer;
  public connections: Map<string, ServerChannel>;

  constructor(server: Server) {
    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.connections = new Map();
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const connId = generateRandomID();
    const conn = new ServerChannel(ws, connId);
    this.connections.set(connId, conn);
    console.info(`client connected: ${connId}`);

    // boadcast the peer connection
    this.broadcast({ type: "add-peer", peer: connId }, connId);

    conn.addMessageHandler("id", (ev) => {
      conn.sendMessage({ type: "set-id", id: connId });
    });

    conn.addMessageHandler("ls-peers", (ev) => {
      const peers = Array.from(this.connections.keys());
      conn.sendMessage({ type: "set-peers", peers });
    });

    conn.addEventListener("close", () => {
      this.connections.delete(connId);
      this.broadcast({ type: "delete-peer", peer: connId }, connId);
    });
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    for (const [id, conn] of this.connections) {
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

export class Server {
  public httpServer: http.Server;
  public channelServer: ChannelServer;

  constructor() {
    this.httpServer = new http.Server((req, resp) => this.onRequest(req, resp));
    this.channelServer = new ChannelServer(this);
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
