import { initState } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";
import { bindIncidentInputs, loadIncidentIntoInputs } from "./js/incident.js";
import { initResponders } from "./js/responders.js";
import { bindOcrEvents } from "./js/ocr.js";
import { bindReportEvents, renderReportPreview } from "./js/report.js";

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  initState();
  bindShellEvents();
  bindIncidentInputs();
  loadIncidentIntoInputs();
  bindOcrEvents();
  await initResponders();

  renderReportPreview();
  bindReportEvents();
  bindReportPreviewRefresh();
}

document.querySelectorAll('[data-page="sendPage"]').forEach(btn => {
  btn.addEventListener("click", () => {
    setTimeout(() => {
      renderReportPreview();
    }, 0);
  });
});

  const refreshIds = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "alertAreaCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "scannedAddress",
    "actualAddress",
    "controlName",
    "firstAgency",
    "distanceToScene",
    "weather1",
    "weather2",
    "injuryNotes",
    "signalNotes"
  ];

  refreshIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const eventName =
      el.tagName === "SELECT" || el.type === "date" || el.type === "time"
        ? "change"
        : "input";

    el.addEventListener(eventName, () => {
      renderReportPreview();
    });
  });

  const reportPage = document.getElementById("sendPage");
  if (reportPage) {
    reportPage.addEventListener("click", () => {
      renderReportPreview();
    });
  }
