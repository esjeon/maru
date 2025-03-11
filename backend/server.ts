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
    this.channels.set(ch.id!, ch);
    this.registerChannelMessageHandler(ch);

    console.info(`client connected: ${ch.id}`);

    ch.addEventListener("close", () => {
      this.channels.delete(ch.id!);
      this.broadcast({ delPeer: ch.id! }, ch.id!);
    });

    // Send the welcome message.
    ch.sendMessage({
      identity: ch.id!,
      peers: Array.from(this.channels.keys()),
    });

    // Tell others about the new peer.
    this.broadcast({ addPeer: ch.id! }, ch.id!);
  }

  private registerChannelMessageHandler(ch: Channel): void {
    ch.addMessageHandler("rtc", (ev) => {
      const rtc = ev.detail;
      if (ch.id !== rtc.from) {
        return console.warn(
          "ChannelServer ignored message with invalid sender",
          rtc,
        );
      }

      const destChannel = this.channels.get(rtc.to);
      if (!destChannel) {
        return console.warn(
          "ChannelServer ignored message with invalid recipient",
          rtc,
        );
      }

      destChannel.sendMessage({ rtc });
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
