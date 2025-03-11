import { Mesh } from "./Mesh";
import { SignalingChannel } from "./SignalingChannel";
import { generateRandomID } from "../shared/utils";

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

export class App {
  public readonly id: string;
  public signalingChannel: SignalingChannel;

  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  public peers: Set<string>;
  public mesh: Mesh;

  constructor() {
    this.id = generateRandomID("app");
    this.signalingChannel = new SignalingChannel(this.id);
    this.registerChannelHandlers();

    this.videos = new Set();
    this.videoList = document.createElement("ul");

    this.peers = new Set();
    this.mesh = new Mesh(this.id, this.signalingChannel, {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  }

  private registerChannelHandlers(): void {
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
