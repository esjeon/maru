import { readFile } from "node:fs/promises";
import * as http from "node:http";
import { join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";

import { GenericChannel, messages as M } from "../shared/channel";
import { NodeWebSocketAdapter } from "./NodeWebSocketAdaptor";

const MAIN_HTML_PATH = "../static/main.html";

function generateRandomID(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

class Channel extends GenericChannel<M.ClientMessage, M.ServerMessage> {
  constructor(ws: WebSocket, id?: string) {
    super(new NodeWebSocketAdapter(ws), M.isClientMessage, id);
  }
}

class ChannelServer {
  public wsServer: WebSocketServer;
  public channels: Map<string, Channel>;

  constructor(server: AppServer) {
    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.channels = new Map();
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const ch = new Channel(ws, generateRandomID());
    this.registerChannelMessageHandler(ch);

    this.channels.set(ch.id!, ch);
    console.info(`client connected: ${ch.id}`);

    this.broadcast({ type: "add-peer", peer: ch.id! }, ch.id!);

    ch.addEventListener("close", () => {
      this.channels.delete(ch.id!);
      this.broadcast({ type: "delete-peer", peer: ch.id! }, ch.id!);
    });
  }

  private registerChannelMessageHandler(ch: Channel): void {
    ch.addMessageHandler("id", (ev) => {
      ch.sendMessage({ type: "set-id", id: ch.id! });
    });

    ch.addMessageHandler("ls-peers", (ev) => {
      const peers = Array.from(this.channels.keys());
      ch.sendMessage({ type: "set-peers", peers });
    });
  }

  private broadcast(msg: M.ServerMessage, exceptId?: string): void {
    for (const [id, conn] of this.channels) {
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
