import * as crypto from 'node:crypto';
import EventEmitter from 'node:events';
import { readFile } from 'node:fs/promises';
import * as http from 'node:http';
import { ListenOptions } from 'node:net';
import * as path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

const DEFAULT_HTTP_PORT = 3000;
const MAIN_HTML_PATH = '../static/main.html'

export class MaruServer {
  public http: http.Server;
  public ws: WebSocketServer;

  public validKeys: Set<string>;

  constructor() {
    const self = this;

    this.http = new http.Server(async (req, resp) => {
      try {
        await self.onHttpRequest(req, resp);
      } catch (e) {
        console.error(e);
        resp.writeHead(500, { 'Content-Type': 'text/plain' });
        resp.end('Interal Server Error');
      }
    });

    this.ws = new WebSocketServer({ server: this.http });
    this.ws.addListener('connection', (sock, req) => self.onWSConnect(sock, req));

    this.validKeys = new Set(['secret1', 'secret2', 'secret3']);
  }

  public async listen(opts?: ListenOptions): Promise<void> {
    if (!opts) opts = {};
    if (!opts.port) opts.port = DEFAULT_HTTP_PORT;
    if (!opts.host) opts.host = 'localhost';

    await new Promise((resolve, reject) => {
      try {
        this.http.listen(opts, () => resolve(undefined))
      } catch (e) {
        reject(e);
      }
    });
    console.log(`Server running at http://${opts.host}:${opts.port}/`);
  }

  private async onHttpRequest(req: http.IncomingMessage, resp: http.ServerResponse): Promise<void> {
    if (req.url === '/') {
      if (req.method === 'GET') {
        const html = await readFile(path.join(import.meta.dirname, MAIN_HTML_PATH));
        resp.writeHead(200, { 'Content-Type': 'text/html' });
        resp.end(html);
      } else {
        resp.writeHead(405, { 'Content-Type': 'text/plain' });
        resp.end('Method Not Allowed');
      }
    } else {
      resp.writeHead(404, { 'Content-Type': 'text/plain' });
      resp.end('Not Found');
    }
  }

  private async onWSConnect(sock: WebSocket, req: http.IncomingMessage): Promise<void> {
    // TODO: register a new session
  }
}