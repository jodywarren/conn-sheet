import { initState } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";
import { bindIncidentInputs } from "./js/incident.js";

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {

  initState();

  bindShellEvents();

  bindIncidentInputs();

}
