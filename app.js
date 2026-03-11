import { initState } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";
import { bindIncidentInputs, loadIncidentIntoInputs } from "./js/incident.js";
import { initResponders } from "./js/responders.js";
import { bindOcrEvents } from "./js/ocr.js";

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  initState();
  bindShellEvents();
  bindIncidentInputs();
  loadIncidentIntoInputs();
  bindOcrEvents();
  await initResponders();
}
