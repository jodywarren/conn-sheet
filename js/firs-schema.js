import { state, saveState, setCurrentPage } from "./state.js";

export const FIRS_PATHWAYS = {
  "short-primary": {
    label: "Primary - short pathway",
    sections: [
      ["incident-details", "Incident details", "active"],
      ["further-incident-details", "Further incident details", "active"],
      ["appliances", "Appliances", "active"],
      ["people", "People", "active"],
      ["brigade-response", "Brigade response", "active"],
      ["incident-summary", "Incident summary", "active"]
    ]
  },
  "fire-primary": {
    label: "Primary - fire pathway",
    sections: [
      ["incident-details", "Incident details", "active"],
      ["further-incident-details", "Further incident details", "active"],
      ["hazardous-materials", "Hazardous materials", "inactive"],
      ["casualties", "Casualties", "active"],
      ["ignition", "Ignition", "active"],
      ["fire-fighting", "Fire fighting", "active"],
      ["dollar-loss-fires", "Dollar loss fires", "inactive"],
      ["exposures", "Exposures", "active"],
      ["appliances", "Appliances", "active"],
      ["people", "People", "active"],
      ["brigade-response", "Brigade response", "active"],
      ["incident-summary", "Incident summary", "active"]
    ]
  },
  "vehicle-fire": {
    label: "Primary - vehicle fire pathway",
    sections: [
      ["incident-details", "Incident details", "active"],
      ["further-incident-details", "Further incident details", "active"],
      ["hazardous-materials", "Hazardous materials", "inactive"],
      ["casualties", "Casualties", "active"],
      ["ignition", "Ignition", "active"],
      ["fire-fighting", "Fire fighting", "active"],
      ["dollar-loss-fires", "Dollar loss fires", "active"],
      ["mobile-properties", "Mobile properties", "active"],
      ["exposures", "Exposures", "active"],
      ["appliances", "Appliances", "active"],
      ["people", "People", "active"],
      ["brigade-response", "Brigade response", "active"],
      ["incident-summary", "Incident summary", "active"]
    ]
  },
  "mva-primary": {
    label: "Primary - vehicle/MVA pathway",
    sections: [
      ["incident-details", "Incident details", "active"],
      ["further-incident-details", "Further incident details", "active"],
      ["hazardous-materials", "Hazardous materials", "inactive"],
      ["casualties", "Casualties", "active"],
      ["mobile-properties", "Mobile properties", "active"],
      ["exposures", "Exposures", "active"],
      ["appliances", "Appliances", "active"],
      ["people", "People", "active"],
      ["brigade-response", "Brigade response", "active"],
      ["incident-summary", "Incident summary", "active"]
    ]
  },
  "support": {
    label: "Support report",
    sections: [
      ["callout", "Callout", "active"],
      ["appliances", "Appliances", "active"],
      ["people", "People", "active"],
      ["sign-off", "Sign off", "active"],
      ["incident-comments", "Incident comments", "active"],
      ["attachments", "Attachments", "active"]
    ]
  }
};

const SECTION_ROUTES = {
  "incident-details": ["incidentPage", "incidentDetailsSection"],
  "callout": ["incidentPage", "supportCalloutSection"],
  "further-incident-details": ["incidentPage", "operationalDetailsSection"],
  "brigade-response": ["incidentPage", "brigadeResponseSection"],
  "appliances": ["respondersPage", "conn1Panel"],
  "people": ["respondersPage", "respondersHeading"],
  "incident-summary": ["sendPage", "incidentSummarySection"],
  "sign-off": ["sendPage", "supportSignoffSection"],
  "incident-comments": ["sendPage", "supportIncidentCommentsSection"],
  "attachments": ["specialistPage", null],
  "casualties": ["specialistPage", null],
  "ignition": ["specialistPage", null],
  "fire-fighting": ["specialistPage", null],
  "dollar-loss-fires": ["specialistPage", null],
  "mobile-properties": ["specialistPage", null],
  "exposures": ["specialistPage", null],
  "hazardous-materials": ["specialistPage", null]
};

export function ensureFirsState() {
  if (!state.firs) state.firs = {};
  if (!FIRS_PATHWAYS[state.firs.pathway]) state.firs.pathway = "short-primary";
  if (!state.firs.currentSection) state.firs.currentSection = "incident-details";
  if (!state.firs.casualties) {
    state.firs.casualties = {
      brigadeInjured: "",
      brigadeFatalities: "",
      otherInjured: "",
      otherFatalities: "",
      personsExtricated: "",
      personsReleased: "",
      personsAssisted: "",
      personsEvacuated: "",
      comments: ""
    };
  }
}

export function bindFirsNavigation(goToPage) {
  ensureFirsState();
  const pathwaySelect = document.getElementById("firsPathwaySelect");
  if (pathwaySelect) {
    pathwaySelect.innerHTML = Object.entries(FIRS_PATHWAYS)
      .map(([value, def]) => `<option value="${value}">${def.label}</option>`)
      .join("");
    pathwaySelect.value = state.firs.pathway;
    pathwaySelect.addEventListener("change", () => {
      state.firs.pathway = pathwaySelect.value;
      const first = getSections().find((s) => s.state === "active");
      state.firs.currentSection = first?.id || "incident-details";
      saveState();
      document.dispatchEvent(new Event("firs:pathwayChanged"));
      renderFirsNavigation(goToPage);
    });
  }

  renderFirsNavigation(goToPage);
}

export function renderFirsNavigation(goToPage) {
  ensureFirsState();
  const nav = document.getElementById("firsNav");
  if (!nav) return;
  nav.innerHTML = "";

  getSections().forEach((section) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `firs-tab ${section.state === "inactive" ? "inactive" : ""}`;
    if (section.id === state.firs.currentSection) btn.classList.add("active");
    if (isSectionComplete(section.id)) btn.classList.add("complete");
    btn.textContent = section.label;
    if (section.state === "inactive") {
      btn.disabled = true;
      btn.title = "Displayed in FIRS but inactive for this pathway";
    } else {
      btn.addEventListener("click", () => openFirsSection(section.id, goToPage));
    }
    nav.appendChild(btn);
  });
}

export function openFirsSection(sectionId, goToPage) {
  ensureFirsState();
  state.firs.currentSection = sectionId;
  saveState();
  const [pageId, anchorId] = SECTION_ROUTES[sectionId] || ["specialistPage", null];
  goToPage(pageId);

  if (pageId === "specialistPage") renderSpecialistSection(sectionId);
  setTimeout(() => {
    const anchor = anchorId ? document.getElementById(anchorId) : null;
    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
  renderFirsNavigation(goToPage);
}

export function refreshFirsNavigation(goToPage) {
  renderFirsNavigation(goToPage);
}

function getSections() {
  ensureFirsState();
  return FIRS_PATHWAYS[state.firs.pathway].sections.map(([id, label, sectionState]) => ({
    id,
    label,
    state: sectionState
  }));
}

function isSectionComplete(sectionId) {
  switch (sectionId) {
    case "incident-details": {
      const d = state.firs?.incidentDetails || {};
      return Boolean(state.incident.actualAddress && d.typeOfIncident && d.hazardClass && d.arrivedFirst && d.incidentControllerAgency);
    }
    case "callout": {
      const s = state.firs?.supportReport || {};
      return Boolean(state.incident.actualAddress && s.primaryBrigade && s.incidentType);
    }
    case "further-incident-details": {
      const f = state.firs?.furtherDetails || {};
      return Boolean(f.generalPropertyUse && f.fixedPropertyUse && f.ambulanceAttendance && f.policeAttendance);
    }
    case "appliances": {
      const used = Object.values(state.responders.appliances || {}).filter((a) => (a.crew || []).length > 0);
      return used.length > 0 && used.every((a) => a.code && String(a.km || "").trim() && a.crew.some((m) => m.isDriver));
    }
    case "people":
      return Object.values(state.responders.appliances || {}).some((a) => (a.crew || []).length > 0)
        || (state.responders.stationResponders || []).length > 0
        || (state.responders.directResponders || []).length > 0;
    case "casualties":
      return casualtiesTouched();
    case "brigade-response": {
      const b = state.firs?.brigadeResponse || {};
      return Boolean(b.primaryBrigade && b.officerInCharge && b.asbestosExposure && b.hotDebrief && b.aarRequired);
    }
    case "incident-summary": {
      const m = state.firs?.incidentSummary || {};
      return Boolean(m.significantIncident && String(m.brigadeComments || "").trim());
    }
    case "sign-off":
      return false;
    case "incident-comments":
      return Boolean(String(state.firs?.supportReport?.incidentComments || "").trim());
    default:
      return false;
  }
}

function casualtiesTouched() {
  const c = state.firs.casualties || {};
  return Object.values(c).some((value) => String(value || "").trim() !== "");
}

function renderSpecialistSection(sectionId) {
  const title = document.getElementById("specialistTitle");
  const body = document.getElementById("specialistBody");
  if (!title || !body) return;
  const section = getSections().find((s) => s.id === sectionId);
  title.textContent = section?.label || "FIRS section";

  if (sectionId === "casualties") {
    const c = state.firs.casualties;
    body.innerHTML = `
      <p class="subtle">Exact fields captured from the FIRS Casualties, Rescue and Evacuation screen.</p>
      <div class="firs-field-group"><h3>Casualties</h3><div class="grid">
        ${numField("brigadeInjured", "Brigade members injured")}
        ${numField("brigadeFatalities", "Brigade member fatalities")}
        ${numField("otherInjured", "Other persons injured")}
        ${numField("otherFatalities", "Other persons fatalities")}
      </div></div>
      <div class="firs-field-group"><h3>Rescue and assistance</h3><div class="grid">
        ${numField("personsExtricated", "Persons extricated")}
        ${numField("personsReleased", "Persons released")}
        ${numField("personsAssisted", "Persons assisted by brigade")}
      </div></div>
      <div class="firs-field-group"><h3>Evacuation</h3><div class="grid">
        ${numField("personsEvacuated", "Persons evacuated")}
      </div></div>
      <div class="firs-field-group"><h3>Additional information</h3>
        <label>Comments<textarea id="firsCasualtyComments" rows="4" class="field-input editable-field">${escapeHtml(c.comments || "")}</textarea></label>
      </div>`;

    body.querySelectorAll("[data-firs-casualty]").forEach((input) => {
      input.addEventListener("input", () => {
        state.firs.casualties[input.dataset.firsCasualty] = input.value;
        saveState();
      });
    });
    document.getElementById("firsCasualtyComments")?.addEventListener("input", (event) => {
      state.firs.casualties.comments = event.target.value;
      saveState();
    });
    return;
  }

  const notes = {
    "ignition": "The exact field names and dependencies are known. Dropdown values are still incomplete, so this build does not invent selectable answers.",
    "fire-fighting": "This FIRS section is part of the observed pathway. Its exact selectable values still need to be captured before controls are enabled.",
    "dollar-loss-fires": "This section is active on observed vehicle-fire reports. Exact fields will be added only from confirmed FIRS screens.",
    "mobile-properties": "The section is active for vehicle/MVA pathways. The existing MVA capture remains available under Further incident details while the exact FIRS Mobile Properties schema is mapped.",
    "exposures": "The section is present in observed reports. Exact entry controls are intentionally not guessed.",
    "attachments": "Support-report attachment handling has not yet been mapped to exact FIRS controls.",
    "hazardous-materials": "This section is shown as inactive in the currently observed pathways."
  };
  body.innerHTML = `<div class="firs-schema-notice"><strong>Schema placeholder</strong><p>${notes[sectionId] || "This section has been identified in FIRS but its exact entry controls are not yet confirmed."}</p></div>`;
}

function numField(key, label) {
  const value = state.firs.casualties?.[key] ?? "";
  return `<label>${label}<input data-firs-casualty="${key}" class="field-input editable-field" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(value)}" /></label>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
