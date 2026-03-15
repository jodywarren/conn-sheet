import { initState, setCurrentPage } from "./js/state.js";
import { bindShellEvents } from "./js/render.js";
import { bindIncidentInputs, loadIncidentIntoInputs } from "./js/incident.js";
import { initResponders, renderRespondersPage } from "./js/responders.js";
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

  injectStatusRefreshButton();
  injectBottomPageNav();
  bindReportEvents();
  bindReportAutoRefresh();

  renderReportPreview();
}

function goToPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  setCurrentPage(pageId);

  if (pageId === "incidentPage") {
    loadIncidentIntoInputs();
  }

  if (pageId === "respondersPage") {
    renderRespondersPage();
  }

  if (pageId === "sendPage") {
    renderReportPreview();
  }
}

function injectBottomPageNav() {
  addBottomNav("incidentPage", [
    { label: "Next: Responders", page: "respondersPage", className: "primary-btn" }
  ]);

  addBottomNav("respondersPage", [
    { label: "Back: Incident", page: "incidentPage", className: "secondary-btn" },
    { label: "Next: Send Report", page: "sendPage", className: "primary-btn" }
  ]);

  addBottomNav("sendPage", [
    { label: "Back: Responders", page: "respondersPage", className: "secondary-btn" }
  ]);
}

function addBottomNav(pageId, buttons) {
  const page = document.getElementById(pageId);
  if (!page) return;

  const card = page.querySelector(".card");
  if (!card) return;

  const existing = card.querySelector(".page-bottom-nav");
  if (existing) existing.remove();

  const nav = document.createElement("div");
  nav.className = "page-bottom-nav row wrap";

  buttons.forEach((btnConfig) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = btnConfig.className;
    btn.textContent = btnConfig.label;
    btn.addEventListener("click", () => goToPage(btnConfig.page));
    nav.appendChild(btn);
  });

  card.appendChild(nav);
}

function injectStatusRefreshButton() {
  const statusWrap = document.querySelector(".status-wrap");
  const connectionBanner = document.getElementById("connectionBanner");

  if (!statusWrap || !connectionBanner) return;
  if (document.getElementById("reportRefreshBtn")) return;

  const split = document.createElement("div");
  split.className = "status-split";

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "reportRefreshBtn";
  refreshBtn.type = "button";
  refreshBtn.className = "status-banner refresh-action";
  refreshBtn.textContent = "Refresh Report";

  refreshBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Hard refresh report preview from current saved fields?");
    if (!confirmed) return;

    loadIncidentIntoInputs();
    renderRespondersPage();
    renderReportPreview();
  });

  statusWrap.insertBefore(split, connectionBanner);
  split.appendChild(connectionBanner);
  split.appendChild(refreshBtn);
}

function bindReportAutoRefresh() {
  document.querySelectorAll('[data-page="sendPage"]').forEach((btn) => {
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
    "signalNotes",
    "respondersInjuryNotes"
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
}
