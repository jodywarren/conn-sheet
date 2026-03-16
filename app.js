import { initState, resetState, setCurrentPage, state, saveState, renderOicBanner } from "./js/state.js";
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
  bindOcrEvents();

  await initResponders();

  bindReportEvents();

  loadIncidentIntoInputs();
  renderReportPreview();

  injectNewJobButton();
  injectBottomPageNav();
  bindReportAutoRefresh();
  bindSupportOicFields();
  syncSupportOicUi();

  document.addEventListener("incident:loaded", () => {
    syncSupportOicUi();
    renderReportPreview();
  });
}

function injectNewJobButton() {
  const statusWrap = document.querySelector(".status-wrap");
  const connectionBanner = document.getElementById("connectionBanner");

  if (!statusWrap || !connectionBanner) return;
  if (document.getElementById("newJobBtn")) return;

  const split = document.createElement("div");
  split.className = "status-split";

  const newJobBtn = document.createElement("button");
  newJobBtn.id = "newJobBtn";
  newJobBtn.className = "status-banner new-job-action";
  newJobBtn.textContent = "New Job";

  newJobBtn.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Start a new job?\n\nThis will clear the entire sheet."
    );

    if (!confirmed) return;

    resetState();
    loadIncidentIntoInputs();
    renderRespondersPage();
    renderReportPreview();
    syncSupportOicUi();
    goToPage("incidentPage");
  });

  statusWrap.insertBefore(split, connectionBanner);
  split.appendChild(connectionBanner);
  split.appendChild(newJobBtn);
}

function injectBottomPageNav() {
  addNav("incidentPage", [
    { label: "Next: Responders", page: "respondersPage", className: "primary-btn" }
  ]);

  addNav("respondersPage", [
    { label: "Back: Incident", page: "incidentPage", className: "secondary-btn" },
    { label: "Next: Send Report", page: "sendPage", className: "primary-btn" }
  ]);

  addNav("sendPage", [
    { label: "Back: Responders", page: "respondersPage", className: "secondary-btn" }
  ]);
}

function addNav(pageId, buttons) {
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

    btn.addEventListener("click", () => {
      goToPage(btnConfig.page);
    });

    nav.appendChild(btn);
  });

  card.appendChild(nav);
}

function goToPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  setCurrentPage(pageId);

  if (pageId === "incidentPage") loadIncidentIntoInputs();
  if (pageId === "respondersPage") renderRespondersPage();
  if (pageId === "sendPage") renderReportPreview();

  syncSupportOicUi();
}

function bindReportAutoRefresh() {
  document.querySelectorAll('[data-page="sendPage"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimeout(() => {
        renderReportPreview();
      }, 0);
    });
  });
}

function bindSupportOicFields() {
  const nameInput = document.getElementById("supportOicName");
  const phoneInput = document.getElementById("supportOicPhone");

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      if (!isSupportJob()) return;
      state.responders.oicName = nameInput.value.trim();
      saveState();
      renderOicBanner();
      renderReportPreview();
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      if (!isSupportJob()) return;
      state.responders.oicPhone = phoneInput.value.trim();
      saveState();
      renderOicBanner();
      renderReportPreview();
    });
  }
}

function isSupportJob() {
  const role = String(state.incident.brigadeRole || "").trim();
  return role.startsWith("Support to ");
}

function syncSupportOicUi() {
  const wrap = document.getElementById("supportOicWrap");
  const editBtn = document.getElementById("editOicBtn");
  const nameInput = document.getElementById("supportOicName");
  const phoneInput = document.getElementById("supportOicPhone");

  if (!wrap || !editBtn) return;

  const supportMode = isSupportJob();

  wrap.classList.toggle("hidden", !supportMode);
  editBtn.classList.toggle("hidden", supportMode);

  if (supportMode) {
    if (nameInput) nameInput.value = state.responders.oicName || "";
    if (phoneInput) phoneInput.value = state.responders.oicPhone || "";
  }
}
