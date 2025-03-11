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

  public mesh: Mesh;

  constructor() {
    this.id = generateRandomID("app");
    this.signalingChannel = new SignalingChannel(this.id);
    this.registerChannelHandlers();

    this.videos = new Set();
    this.videoList = document.createElement("ul");

    this.mesh = new Mesh(this.id, this.signalingChannel, {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  }

  private registerChannelHandlers(): void {
    this.signalingChannel.addMessageHandler("peers", (ev) => {
      this.mesh.setPeers(new Set(ev.detail));
    });

    this.signalingChannel.addMessageHandler("addPeer", (ev) => {
      const peerId = ev.detail;
      this.mesh.addPeer(peerId);
    });

    this.signalingChannel.addMessageHandler("delPeer", (ev) => {
      const peerId = ev.detail;
      this.mesh.removePeer(peerId);
    });

    this.signalingChannel.addMessageHandler("rtc", (ev) => {
      this.mesh.handleRTCMessage(ev.detail);
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

  public async throwStreamDemo(): Promise<void> {
    const video = this.videos.values().next().value!;
    const mediaStream = video.srcObject as MediaStream;
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];
    console.log(mediaStream.getAudioTracks());

    this.mesh.connections.forEach((conn, peerId) => {
      conn.rtcConnection.addTrack(videoTrack, mediaStream);
      if (audioTrack) conn.rtcConnection.addTrack(audioTrack, mediaStream);

      if (conn.isMaker) conn.makeCall();
      else
        this.signalingChannel.sendMessage({
          rtc: { from: this.id, to: peerId, negotiate: true },
        });
    });
  }
}
