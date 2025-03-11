import { GenericChannel, messages as M } from "../shared/channel";

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

class Channel extends GenericChannel<M.ServerMessage, M.ClientMessage> {
  constructor(
    socket: WebSocket,
    public id?: string,
  ) {
    super(socket, M.isServerMessage, id);
  }
}

class App {
  public channel: Channel;

  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  public peers: Set<string>;

  constructor() {
    const ws = new WebSocket(window.location.origin + "/socket");

    this.channel = new Channel(ws);
    this.registerChannelHandlers();

    this.videos = new Set();
    this.videoList = document.createElement("ul");

    this.peers = new Set();
  }

  private registerChannelHandlers(): void {
    this.channel.addMessageHandler("peers", (ev) => {
      this.peers = new Set(ev.detail);
    });

    this.channel.addMessageHandler("addPeer", (ev) => {
      this.peers.add(ev.detail);
      console.debug("App set-peer", ev, this.peers);
    });

    this.channel.addMessageHandler("delPeer", (ev) => {
      this.peers.delete(ev.detail);
      console.debug("Appp delete-peer", ev, this.peers);
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
