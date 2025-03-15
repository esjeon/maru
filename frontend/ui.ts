import { App } from "./app";

export class StreamListUI {
  ul: HTMLUListElement;
  videoElementMap: WeakMap<MediaStream, HTMLVideoElement>;

  constructor(private app: App) {
    this.ul = document.createElement("ul");
    this.videoElementMap = new WeakMap();
  }

  render() {
    // empty the list
    while (this.ul.firstChild) this.ul.removeChild(this.ul.firstChild);

    // add list items
    for (const stream of this.app.streams) {
      let video = this.videoElementMap.get(stream);
      if (!video) {
        video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.addEventListener("loadedmetadata", () => video!.play());

        this.videoElementMap.set(stream, video);
      }

      const throwBtn = document.createElement("button");
      throwBtn.innerText = "Throw";
      throwBtn.type = "button";
      throwBtn.addEventListener("click", () => {
        // TODO: pick the target peer
        const peerId = this.app.mesh.connections.keys().next().value!;

        this.app.mesh.throwStream(peerId, stream);
      });

      const li = document.createElement("li");
      li.append(video);
      li.append(throwBtn);
      this.ul.append(li);
    }
  }
}
