import { state, saveState } from "./state.js";

export function bindIncidentInputs() {
  bindBasicFields();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
}

function bindBasicFields() {
  const fields = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "brigadeCode",
    "incidentType",
    "pagerDetails",
    "actualLocation",
    "controlName"
  ];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      state.incident[id] = el.value.trim();
      saveState();
    });
  });
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("change", () => {
    state.incident[id] = el.value;
    saveState();
  });
}

export function loadIncidentIntoInputs() {
  const fieldIds = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "brigadeCode",
    "incidentType",
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
    el.value = state.incident[id] || "";
  });
}
