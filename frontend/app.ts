import * as signaling from "../shared/signaling";

declare global {
  interface Set<T> {
    difference(other: Set<T>): Set<T>;
  }
}

interface SystemAudioField {
  systemAudio: "include" | "exclude";
}

const displayMediaOptions: DisplayMediaStreamOptions & SystemAudioField = {
  video: {
    displaySurface: ["browser", "window"],
  },
  audio: true,
  systemAudio: "include",
};

class SignalingChannel extends signaling.GenericChannel<
  signaling.ServerMessage,
  signaling.ClientMessage
> {
  constructor(
    ws: WebSocket,
    public id?: string,
  ) {
    super(ws, signaling.isServerMessage, id);
  }
}

class Mesh extends EventTarget {
  public id?: string;
  public conns: Map<string, RTCPeerConnection>;
  public dc: Map<string, RTCDataChannel>;

  // TODO: make sure ID exists...
  constructor(
    public signal: SignalingChannel,
    public rtcConfig: RTCConfiguration,
  ) {
    super();

    this.conns = new Map();

    this.signal.addMessageHandler("rtc", (ev) => this.handleRTCMessage(ev));
    this.dc = new Map();
  }

  private async handleRTCMessage(
    ev: CustomEvent<NonNullable<signaling.Message["rtc"]>>,
  ): Promise<void> {
    const msg = ev.detail;
    if (!(this.id && msg.to === this.id)) {
      return console.warn("ignored message with wrong recipient", ev);
    }

    const conn = this.conns.get(msg.from);
    if (!conn) {
      return console.warn("ignored message with wrong sender", ev);
    }

    // TODO: check who's initiating the connection
    if (msg.answer) {
      const remoteDesc = new RTCSessionDescription(msg.answer);
      return conn.setRemoteDescription(remoteDesc);
    }

    if (msg.offer) {
      conn.setRemoteDescription(new RTCSessionDescription(msg.offer));

      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);

      this.signal.sendMessage({
        rtc: { from: this.id, to: msg.from, answer },
      });
      return;
    }

    if (msg.iceCandidate) {
      try {
        await conn.addIceCandidate(msg.iceCandidate);
      } catch (err) {
        console.error("Error adding received ice candidate", err);
      }
      return;
    }
  }

  private async rtcMakeCall(
    conn: RTCPeerConnection,
    peerId: string,
  ): Promise<void> {
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);

    this.signal.sendMessage({ rtc: { from: this.id!, to: peerId, offer } });
  }

  public async addPeer(peerId: string): Promise<void> {
    if (peerId === this.id!) return;
    if (this.conns.has(peerId)) return;

    const conn = new RTCPeerConnection(this.rtcConfig);
    this.conns.set(peerId, conn);

    if (this.id! < peerId) {
      console.log("make call", peerId);
      const dc = conn.createDataChannel("testchannel");
      this.dc.set(peerId, dc);

      dc.addEventListener("open", (ev) => {
        console.log("datachannel open", ev);
        dc.send("Hello World");
      });

      this.rtcMakeCall(conn, peerId);
    } else {
      console.log("waiting for call", peerId);

      conn.addEventListener("datachannel", (ev) => {
        console.log("RTCPeerConnection datachannel", ev);
        const dc = ev.channel;
        this.dc.set(peerId, dc);

        dc.addEventListener("message", (ev) => {
          console.log("DataChannel message", ev);
        });
      });
    }

    conn.addEventListener("icecandidate", (ev) => {
      console.log(ev);
      if (ev.candidate) {
        this.signal.sendMessage({
          rtc: { from: this.id!, to: peerId, iceCandidate: ev.candidate },
        });
      }
    });
  }

  public removePeer(peerId: string) {
    const conn = this.conns.get(peerId);
    if (conn) conn.close();

    this.dc.delete(peerId);
    this.conns.delete(peerId);
  }
}

class App {
  public signalingChannel: SignalingChannel;

  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  public peers: Set<string>;
  public mesh: Mesh;

  constructor() {
    const ws = new WebSocket(window.location.origin + "/socket");

    this.signalingChannel = new SignalingChannel(ws);
    this.registerChannelHandlers();

    this.videos = new Set();
    this.videoList = document.createElement("ul");

    this.peers = new Set();
    this.mesh = new Mesh(this.signalingChannel, {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  }

  private registerChannelHandlers(): void {
    this.signalingChannel.addMessageHandler("identity", (ev) => {
      this.mesh.id = ev.detail;
    });

    this.signalingChannel.addMessageHandler("peers", (ev) => {
      const newPeers = new Set(ev.detail);

      const removed = this.peers.difference(newPeers);
      removed.forEach((id) => this.mesh.removePeer(id));

      const added = newPeers.difference(this.peers);
      added.forEach((id) => this.mesh.addPeer(id));

      this.peers = newPeers;
    });

    this.signalingChannel.addMessageHandler("addPeer", (ev) => {
      const peerId = ev.detail;
      this.peers.add(peerId);
      this.mesh.addPeer(peerId);
    });

    this.signalingChannel.addMessageHandler("delPeer", (ev) => {
      this.peers.delete(ev.detail);
    });
  }

  public async addStream(): Promise<void> {
    const captureStream =
      await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    // Create <video> and attach the stream.
    const video = document.createElement("video")!;
    video.srcObject = captureStream;
    video.onloadedmetadata = () => video.play();
    this.videos.add(video);

    // Add the <video> to <ul>
    const listItem = document.createElement("li");
    listItem.append(video);
    this.videoList.append(listItem);

    // Remove the <video> from the <ul> when the stream stops.
    // XXX: Typescript is missing `MediaStream.oninactive`.
    // @ts-ignore
    captureStream.oninactive = () => {
      this.videos.delete(video);
      listItem.remove();
    };
  }
}

window.addEventListener("load", () => {
  const app = new App();
  console.log(app);

  document.querySelector("section#videos")!.append(app.videoList);

  document
    .querySelector("#videos-add")!
    .addEventListener("click", () => app.addStream());
});
