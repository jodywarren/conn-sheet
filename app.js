import { initState } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";
import { bindIncidentInputs } from "./js/incident.js";
import { initResponders } from "./js/responders.js";

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  initState();
  bindShellEvents();
  bindIncidentInputs();
  await initResponders();
}
