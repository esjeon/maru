export class StreamListUI {
  ul: HTMLUListElement;
  videoElementMap: WeakMap<MediaStream, HTMLVideoElement>;

  constructor() {
    this.ul = document.createElement("ul");
    this.videoElementMap = new WeakMap();
  }

  render(streams: Iterable<MediaStream>) {
    // empty the list
    while (this.ul.firstChild) this.ul.removeChild(this.ul.firstChild);

    // add list items
    for (const stream of streams) {
      let video = this.videoElementMap.get(stream);
      if (!video) {
        video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.addEventListener("loadedmetadata", () => video!.play());

        this.videoElementMap.set(stream, video);
      }

      const li = document.createElement("li");
      li.append(video);
      this.ul.append(li);
    }
  }
}
