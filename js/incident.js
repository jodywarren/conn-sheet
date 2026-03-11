import { state } from "./state.js";

export function bindIncidentInputs() {

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

    });

  });

}

export function loadIncidentIntoInputs() {

  Object.keys(state.incident).forEach((key) => {

    const el = document.getElementById(key);

    if (!el) return;

    el.value = state.incident[key] || "";

  });

}
