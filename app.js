
import { initState } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  initState();
  bindShellEvents();
}
