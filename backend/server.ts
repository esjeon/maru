import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as http from 'node:http';
import { AddressInfo, ListenOptions } from 'node:net';
import * as path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

const DEFAULT_HTTP_PORT = 3000;
const MAIN_HTML_PATH = '../../static/main.html'

class WSSession {
  public static generateId(): string {
    const timestamp = Date.now().toString(16);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${randomBytes}`;
  }

  public id: string;
  public iceCandidates: any[];

  constructor(
    public sock: WebSocket,
  ) {
    this.id = WSSession.generateId();
    this.iceCandidates = []
  }
}

export class Server {
  public http: http.Server;
  public ws: WebSocketServer;

  public validKeys: Set<string>;
  public sessions: Map<string, WSSession>;

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
    this.sessions = new Map();
  }

  public async listen(opts?: ListenOptions): Promise<void> {
    if (!opts) opts = {};
    if (!opts.port) opts.port = DEFAULT_HTTP_PORT;
    if (!opts.host) opts.host = '127.0.0.1';

    await new Promise((resolve, reject) => {
      try {
        this.http.listen(opts, () => resolve(undefined))
      } catch (e) {
        reject(e);
      }
    });
    const addrInfo = this.http.address() as AddressInfo;
    console.log(`Server running at http://${addrInfo.address}:${addrInfo.port}/`);
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

  private verifyClientKey(key: string): boolean {
    return this.validKeys.has(key);
  }
  
  private onWSConnect(sock: WebSocket, req: http.IncomingMessage): void {
    const self = this;
    
    if (req.url !== '/signaling') {
      const error = new Error(`invalid endpoint: ${req.url}`);
      sock.send(JSON.stringify({ error }));
      return sock.close();
    }

    const session = new WSSession(sock);
    this.sessions.set(session.id, session);

    sock.addEventListener('message', (ev) => self.onWSMessage(session, ev));
    sock.addEventListener('close', (ev) => self.onWSDisconnect(session, ev));
    sock.addEventListener('error', (ev) => console.error("WS: error: %", ev));

    console.info('WS: sessoin opened: session=%s', session.id)
  }
  
  private onWSMessage(session: WSSession, ev: WebSocket.MessageEvent): void {
    try {
      const data = JSON.parse(ev.data as string);
      
      if (!data.key || !this.verifyClientKey(data.key))
        throw new Error('invalid key');

      if (data.iceCandidate)
        session.iceCandidates.push(data.iceCandidate);
    } catch(error) {
      console.error('WS: error in session: session=% error=%s', session.id, error);
      session.sock.send(JSON.stringify({ error }));
      session.sock.close();
    }
  }

  private onWSDisconnect(session: WSSession, ev: WebSocket.CloseEvent): void {
    console.info('WS: sessoin closed: session=%s reason=%s code=%s', session.id, ev.reason, ev.code);
    this.sessions.delete(session.id);
  }
}