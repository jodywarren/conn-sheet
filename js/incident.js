import { state, saveState } from "./state.js";

export function bindIncidentInputs() {
  bindTextInputs();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneBrigades();
}

function bindTextInputs() {
  const plainFields = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "alertAreaCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "scannedAddress",
    "controlName"
  ];

  plainFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      state.incident[id] = el.value.trim();
      saveState();
    });
  });

  const actualAddressEl = document.getElementById("actualAddress");
  if (actualAddressEl) {
    actualAddressEl.addEventListener("input", () => {
      state.incident.actualAddress = actualAddressEl.value.trim();
      state.incident.actualAddressEdited = true;
      saveState();
    });
  }
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("change", () => {
    state.incident[id] = el.value;
    saveState();
  });
}

function bindSceneBrigades() {
  const input = document.getElementById("sceneBrigadeInput");
  const addBtn = document.getElementById("addSceneBrigadeBtn");

  if (!input || !addBtn) return;

  addBtn.addEventListener("click", () => {
    addSceneBrigadeFromInput();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSceneBrigadeFromInput();
    }
  });
}

function addSceneBrigadeFromInput() {
  const input = document.getElementById("sceneBrigadeInput");
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (!code) return;

  if (!state.incident.brigadesOnScene.includes(code)) {
    state.incident.brigadesOnScene.push(code);
  }

  input.value = "";
  renderSceneBrigadeChips();
  saveState();
  input.focus();
}

export function setSceneBrigades(codes = []) {
  state.incident.brigadesOnScene = [...new Set(codes.filter(Boolean).map((x) => String(x).trim().toUpperCase()))];
  renderSceneBrigadeChips();
  saveState();
}

export function mergeSceneBrigades(codes = []) {
  const merged = new Set(state.incident.brigadesOnScene);

  codes.forEach((code) => {
    const clean = String(code || "").trim().toUpperCase();
    if (clean) merged.add(clean);
  });

  state.incident.brigadesOnScene = [...merged];
  renderSceneBrigadeChips();
  saveState();
}

export function renderSceneBrigadeChips() {
  const wrap = document.getElementById("sceneBrigadeChips");
  if (!wrap) return;

  wrap.innerHTML = "";

  state.incident.brigadesOnScene.forEach((code) => {
    const chip = document.createElement("div");
    chip.className = "scene-chip";

    const text = document.createElement("span");
    text.textContent = code;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      state.incident.brigadesOnScene = state.incident.brigadesOnScene.filter((x) => x !== code);
      renderSceneBrigadeChips();
      saveState();
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });
}

export function loadIncidentIntoInputs() {
  const fieldIds = [
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
    "weather2"
  ];

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.incident[id] || "";
  });

  renderSceneBrigadeChips();
}
