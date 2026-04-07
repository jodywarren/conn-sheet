import { state, saveState } from "./state.js";

export function bindIncidentInputs() {
  bindBasicFields();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneBrigades();
}

function bindBasicFields() {
  const fields = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "brigadeCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "actualLocation",
    "controlName"
  ];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      if (!state.incident) state.incident = {};
      state.incident[id] = el.value.trim();
      saveState();
    });
  });
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("change", () => {
    if (!state.incident) state.incident = {};
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

  if (!state.incident.brigadesOnScene) {
    state.incident.brigadesOnScene = [];
  }

  if (!state.incident.brigadesOnScene.includes(code)) {
    state.incident.brigadesOnScene.push(code);
  }

  input.value = "";
  setSceneBrigades(state.incident.brigadesOnScene);
  input.focus();
}

export function setSceneBrigades(codes = []) {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];

  if (!state.incident) state.incident = {};
  state.incident.brigadesOnScene = uniqueCodes;

  const wrap = document.getElementById("sceneBrigadeChips");
  if (!wrap) {
    saveState();
    return;
  }

  wrap.innerHTML = "";

  uniqueCodes.forEach((code) => {
    const chip = document.createElement("div");
    chip.className = "scene-chip";

    const text = document.createElement("span");
    text.textContent = code;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      state.incident.brigadesOnScene = (state.incident.brigadesOnScene || []).filter((x) => x !== code);
      setSceneBrigades(state.incident.brigadesOnScene);
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });

  saveState();
}

export function loadIncidentIntoInputs() {
  const fieldIds = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "brigadeCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "actualLocation",
    "controlName",
    "firstAgency",
    "distanceToScene",
    "weather1",
    "weather2"
  ];

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.incident?.[id] || "";
  });

  setSceneBrigades(state.incident?.brigadesOnScene || []);
}
