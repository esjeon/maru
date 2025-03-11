import { App } from "./app";

window.addEventListener("load", () => {
  const app = new App();
  console.log(app);

  document.querySelector("section#videos")!.append(app.videoList);

  document
    .querySelector("#videos-add")!
    .addEventListener("click", () => app.addStream());

  document
    .querySelector("#videos-throw")!
    .addEventListener("click", () => app.throwStreamDemo());
});
