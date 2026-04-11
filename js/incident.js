import { state, saveState } from "./state.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SIGNAL_OPTIONS = ["27", "55", "83", "40", "56"];
const DETAIL_TABS = ["mva", "structure", "alarm"];

export function bindIncidentInputs() {
  bindTextInputs();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneUnits();
  bindOtherAgencyControls();
  bindOperationalChips();
  bindSignalChips();
  bindDetailTabs();
  bindPanelToggles();
  bindStructurePanels();
  bindStructureInputs();
  applyStructureEquipmentToggles();
applyStructureSectionStates();
}

function ensureMva() {
  if (!state.incident.mva) {
    state.incident.mva = {
      vehicles: [],
      hazards: [],
      outcome: "",
      notes: ""
    };
  }
}

function createEmptyVehicle() {
  return {
    name: "",
    phone: "",
    make: "",
    model: "",
    rego: "",
    state: "",
    notes: "",
    flags: []
  };
}

function renderMvaVehicles() {
  ensureMva();

  const wrap = document.getElementById("mvaVehicleList");
  if (!wrap) return;

  wrap.innerHTML = "";

  state.incident.mva.vehicles.forEach((v, index) => {
    const div = document.createElement("div");
    div.className = "agency-card";

    div.innerHTML = `
      <strong>Vehicle ${index + 1}</strong>

      <input data-v="${index}" data-k="name" placeholder="Contact name" value="${v.name || ""}" />
      <input data-v="${index}" data-k="phone" placeholder="Contact number" inputmode="numeric" value="${v.phone || ""}" />

      <input list="vehicleMakes" data-v="${index}" data-k="make" placeholder="Vehicle make" value="${v.make || ""}" />
      <datalist id="vehicleMakes">
        <option>Holden</option>
        <option>Toyota</option>
        <option>Ford</option>
        <option>Mazda</option>
        <option>Hyundai</option>
        <option>Nissan</option>
        <option>Kia</option>
        <option>Subaru</option>
        <option>Mitsubishi</option>
        <option>Volkswagen</option>
        <option>BMW</option>
        <option>LDV</option>
        <option>Tesla</option>
        <option>BYD</option>
        <option>Volvo</option>
        <option>Hino</option>
        <option>Scania</option>
        <option>Fiat</option>
        <option>Isuzu</option>
        <option>Suzuki</option>
        <option>MG</option>
        <option>GWM</option>
        <option>Chery</option>
        <option>Polestar</option>
        <option>Audi</option>
        <option>Land Rover</option>
        <option>Range Rover</option>
        <option>Lexus</option>
        <option>Skoda</option>
        <option>Peugeot</option>
        <option>Renault</option>
        <option>Jaguar</option>
        <option>Porsche</option>
        <option>Maserati</option>
        <option>Mini</option>
        <option>RAM</option>
        <option>Chevrolet</option>
        <option>Jaecoo</option>
      </datalist>

      <input data-v="${index}" data-k="model" placeholder="Model" value="${v.model || ""}" />
      <input data-v="${index}" data-k="rego" placeholder="Registration" value="${v.rego || ""}" />

      <select data-v="${index}" data-k="state">
        <option value="">State</option>
        <option ${v.state==="VIC"?"selected":""}>VIC</option>
        <option ${v.state==="NSW"?"selected":""}>NSW</option>
        <option ${v.state==="ACT"?"selected":""}>ACT</option>
        <option ${v.state==="TAS"?"selected":""}>TAS</option>
        <option ${v.state==="SA"?"selected":""}>SA</option>
        <option ${v.state==="QLD"?"selected":""}>QLD</option>
        <option ${v.state==="NT"?"selected":""}>NT</option>
        <option ${v.state==="WA"?"selected":""}>WA</option>
      </select>

      <input data-v="${index}" data-k="notes" placeholder="Notes" value="${v.notes || ""}" />

      <div class="chips">
        ${["Airbags","Roll over","Battery disconnected","High speed","Entrapment"].map(flag => `
          <button type="button" class="chip-btn ${v.flags.includes(flag)?"active":""}" data-flag="${flag}" data-v="${index}">
            ${flag}
          </button>
        `).join("")}
      </div>

      <button data-remove="${index}" class="tiny-btn">Remove</button>
    `;

    wrap.appendChild(div);
  });
}

function bindMva() {
  ensureMva();

  const addBtn = document.getElementById("addVehicleBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      state.incident.mva.vehicles.push(createEmptyVehicle());
      saveState();
      renderMvaVehicles();
    };
  }

  document.addEventListener("input", (e) => {
    const v = e.target.dataset.v;
    const k = e.target.dataset.k;
    if (v === undefined || !k) return;

    state.incident.mva.vehicles[v][k] = e.target.value;
    saveState();
  });

  document.addEventListener("click", (e) => {
    if (e.target.dataset.flag !== undefined) {
      const v = e.target.dataset.v;
      const flag = e.target.dataset.flag;

      const arr = state.incident.mva.vehicles[v].flags;

      if (arr.includes(flag)) {
        state.incident.mva.vehicles[v].flags = arr.filter(f => f !== flag);
      } else {
        arr.push(flag);
      }

      saveState();
      renderMvaVehicles();
    }

    if (e.target.dataset.remove !== undefined) {
      const i = e.target.dataset.remove;
      state.incident.mva.vehicles.splice(i, 1);
      saveState();
      renderMvaVehicles();
    }
  });

  const hazardWrap = document.getElementById("mvaHazards");
  if (hazardWrap) {
    hazardWrap.addEventListener("click", (e) => {
      const h = e.target.dataset.hazard;
      if (!h) return;

      const arr = state.incident.mva.hazards;

      if (arr.includes(h)) {
        state.incident.mva.hazards = arr.filter(x => x !== h);
      } else {
        arr.push(h);
      }

      e.target.classList.toggle("active");
      saveState();
    });
  }

  const outcome = document.getElementById("mvaOutcome");
  if (outcome) {
    outcome.value = state.incident.mva.outcome || "";
    outcome.onchange = () => {
      state.incident.mva.outcome = outcome.value;
      saveState();
    };
  }

  const notes = document.getElementById("mvaNotes");
  if (notes) {
    notes.value = state.incident.mva.notes || "";
    notes.oninput = () => {
      state.incident.mva.notes = notes.value;
      saveState();
    };
  }
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
    "actualAddress",
    "controlName",
    "injuryNotes",
    "signalNotes"
  ];

  plainFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundInput === "1") return;

    el.dataset.boundInput = "1";
    el.addEventListener("input", () => {
      if (id === "actualAddress") {
        state.incident.actualAddressEdited = true;
      }

      state.incident[id] = String(el.value || "").trim();
      saveState();
            applyFieldCompletionStates();
    });
  });
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el || el.dataset.boundChange === "1") return;

  el.dataset.boundChange = "1";
  el.addEventListener("change", () => {
    state.incident[id] = el.value;
    applyWeatherRules(id);
    saveState();
    applyFieldCompletionStates();
    loadIncidentIntoInputs();
  });
}

function applyWeatherRules(changedId) {
  const w1 = state.incident.weather1;
  const w2 = state.incident.weather2;

  const incompatibleWithFine = new Set(["Overcast", "Windy", "Rain", "Storm", "Fog", "Smoke"]);

  if (changedId === "weather1" && w1 === "Fine" && incompatibleWithFine.has(w2)) {
    state.incident.weather2 = "";
  }

  if (changedId === "weather2" && incompatibleWithFine.has(w2) && w1 === "Fine") {
    state.incident.weather1 = "";
  }

  if (changedId === "weather2" && w2 === "Sunny" && !w1) {
    state.incident.weather1 = "Fine";
  }
}

function bindSceneUnits() {
  const dropdown = document.getElementById("applianceDropdown");
  const appliancePanel = document.getElementById("appliancePanel");
  const applianceBtn = document.getElementById("tabAddAppliance");

  if (!dropdown || dropdown.dataset.boundChange === "1") return;

  dropdown.dataset.boundChange = "1";
  dropdown.addEventListener("change", () => {
    const raw = String(dropdown.value || "").trim().toUpperCase();
    if (!raw) return;

    const code = normalizeSceneUnit(raw);

    if (!Array.isArray(state.incident.sceneUnits)) {
      state.incident.sceneUnits = [];
    }
    if (!Array.isArray(state.incident.pagedSceneUnits)) {
      state.incident.pagedSceneUnits = [];
    }

    if (!state.incident.sceneUnits.includes(code)) {
      state.incident.sceneUnits.push(code);
    }

    dropdown.value = "";
    renderSceneUnitChips();
    saveState();

    if (appliancePanel) {
      appliancePanel.classList.add("hidden");
    }

    if (applianceBtn) {
      applianceBtn.classList.remove("active");
    }
  });
}

export function setPagedSceneUnits(codes = []) {
  const cleaned = [...new Set(codes.filter(Boolean).map((x) => normalizeSceneUnit(x)))];
  state.incident.pagedSceneUnits = cleaned;
  state.incident.sceneUnits = cleaned.slice();
  renderSceneUnitChips();
  saveState();
}

export function mergePagedSceneUnits(codes = []) {
  const paged = new Set(state.incident.pagedSceneUnits || []);
  const visible = new Set(state.incident.sceneUnits || []);

  codes.forEach((code) => {
    const clean = normalizeSceneUnit(code);
    if (!clean) return;
    paged.add(clean);
    visible.add(clean);
  });

  state.incident.pagedSceneUnits = [...paged];
  state.incident.sceneUnits = [...visible];
  renderSceneUnitChips();
  saveState();
}

export function renderSceneUnitChips() {
  const wrap = document.getElementById("sceneUnitChips");
  if (!wrap) return;

  wrap.innerHTML = "";

  (state.incident.sceneUnits || []).forEach((code) => {
    const chip = document.createElement("div");
    const isPaged = (state.incident.pagedSceneUnits || []).includes(code);

    chip.className = `scene-chip ${isPaged ? "from-pager" : "manual-unit"}`;

    const text = document.createElement("span");
    text.textContent = code;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      state.incident.sceneUnits = (state.incident.sceneUnits || []).filter((x) => x !== code);
      state.incident.pagedSceneUnits = (state.incident.pagedSceneUnits || []).filter((x) => x !== code);
      renderSceneUnitChips();
      saveState();
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });

  const applianceBtn = document.getElementById("tabAddAppliance");
  if (applianceBtn) {
    applianceBtn.classList.toggle("complete", (state.incident.sceneUnits || []).length > 0);
  }
}

function bindOtherAgencyControls() {
  const dropdown = document.getElementById("agencyDropdown");
  const agencyPanel = document.getElementById("agencyPanel");
  const agencyBtn = document.getElementById("tabAddAgency");

  if (!dropdown || dropdown.dataset.boundChange === "1") return;

  dropdown.dataset.boundChange = "1";
  dropdown.addEventListener("change", () => {
    const type = String(dropdown.value || "").trim();
    if (!type) return;

    if (!Array.isArray(state.incident.otherAgencies)) {
      state.incident.otherAgencies = [];
    }

    const agency = createEmptyAgency();
    agency.type = type;

    state.incident.otherAgencies.push(agency);
    dropdown.value = "";

    renderOtherAgencies();
    saveState();

    if (agencyPanel) {
      agencyPanel.classList.add("hidden");
    }

    if (agencyBtn) {
      agencyBtn.classList.remove("active");
    }
  });
}

function createEmptyAgency() {
  return {
    id: uid(),
    type: "",
    agencyName: "",
    name: "",
    contactNumber: "",
    badgeNumber: "",
    idNumber: "",
    station: "",
    localHq: "",
    office: "",
    poleId: "",
    notes: "",
    expanded: true
  };
}

function getAgencySummary(agency) {
  const type = agency.type || "Add Agency";
  const who = agency.name || agency.agencyName || "";
  const number = agency.contactNumber || "";
  return [type, who, number].filter(Boolean).join(" • ");
}

function getAgencyFieldConfig(type) {
  switch (type) {
    case "Police":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "badgeNumber", label: "Badge number", mode: "numeric" },
        { key: "station", label: "Station", mode: "text" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "Ambulance":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "idNumber", label: "ID number", mode: "numeric" },
        { key: "station", label: "Station", mode: "text" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "SES":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "localHq", label: "LHQ", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "PowerCor":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "office", label: "Branch", mode: "text" },
        { key: "poleId", label: "Pole ID", mode: "text" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "Gas":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "Council":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "office", label: "Office", mode: "text" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    case "Other":
      return [
        { key: "agencyName", label: "Agency name", mode: "text" },
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "notes", label: "Notes", mode: "text" }
      ];

    default:
      return [];
  }
}

function isAgencyComplete(agency) {
  if (!agency || !agency.type) return false;
  const fields = getAgencyFieldConfig(agency.type);
  if (!fields.length) return false;
  return fields.every((field) => String(agency[field.key] || "").trim().length > 0);
}

export function renderOtherAgencies() {
  const wrap = document.getElementById("otherAgencyList");
  const tabBtn = document.getElementById("tabAddAgency");
  if (!wrap) return;

  wrap.innerHTML = "";

  (state.incident.otherAgencies || []).forEach((agency) => {
    const fields = getAgencyFieldConfig(agency.type);
    const complete = isAgencyComplete(agency);
    const card = document.createElement("div");
    card.className = `agency-card ${complete ? "complete" : "pending"} ${agency.expanded ? "expanded" : "collapsed"}`;

    if (!agency.expanded) {
      card.innerHTML = `
        <div class="agency-card-head">
          <div class="agency-summary">${escapeHtml(getAgencySummary(agency))}</div>
          <div class="agency-actions">
            <button class="tiny-btn" type="button" data-edit-agency="${agency.id}">Edit</button>
            <button class="tiny-btn" type="button" data-remove-agency="${agency.id}">Remove</button>
          </div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="agency-card-head">
          <div class="agency-summary">${escapeHtml(agency.type || "Add Agency")}</div>
          <div class="agency-actions">
            <button class="tiny-btn" type="button" data-save-agency="${agency.id}">Save</button>
            <button class="tiny-btn" type="button" data-remove-agency="${agency.id}">Remove</button>
          </div>
        </div>

        <div class="grid agency-grid">
          ${fields
            .map((field) => {
              const val = String(agency[field.key] || "");
              const inputType = field.mode === "tel" ? "tel" : "text";
              const inputMode =
                field.mode === "numeric" ? "numeric" : field.mode === "tel" ? "tel" : "text";

              return `
                <label>
                  ${field.label}
                  <input
                    class="field-input editable-field agency-field ${val.trim() ? "field-complete" : ""}"
                    type="${inputType}"
                    inputmode="${inputMode}"
                    value="${escapeHtml(val)}"
                    data-agency-id="${agency.id}"
                    data-field="${field.key}"
                  />
                </label>
              `;
            })
            .join("")}
        </div>
      `;
    }

    wrap.appendChild(card);
  });

  if (tabBtn) {
    const hasAgencies = (state.incident.otherAgencies || []).length > 0;
    tabBtn.classList.toggle("complete", hasAgencies);
  }

  bindRenderedOtherAgencyEvents();
}

function bindStructurePanels() {
  const buttons = document.querySelectorAll('[data-struct]');
  const panels = document.querySelectorAll('[data-struct-panel]');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.struct;

      panels.forEach(p => p.classList.add('hidden'));

      const panel = document.querySelector(`[data-struct-panel="${key}"]`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

function bindStructureInputs() {
  const fieldMap = {
  struct_type: ["quick", "type"],
  struct_construction: ["quick", "construction"],
  struct_levels: ["quick", "levels"],
  struct_roof: ["quick", "roof"],
  struct_involved: ["quick", "involved"],
  struct_saved: ["quick", "saved"],

  struct_area_use: ["fireArea", "areaUse"],
  struct_dimensions: ["fireArea", "dimensions"],
  struct_ceiling: ["fireArea", "ceiling"],
  struct_wall: ["fireArea", "wall"],

  struct_smoke_material: ["behaviour", "smokeMaterial"],
  struct_fire_material: ["behaviour", "fireMaterial"],
  struct_smoke_travel: ["behaviour", "smokeTravel"],
  struct_spread: ["behaviour", "spread"],
  struct_smoke_damage: ["behaviour", "smokeDamage"],
  struct_water_damage: ["behaviour", "waterDamage"],

  struct_alarm: ["detection", "alarm"],
  struct_alarm_status: ["detection", "alarmStatus"],
  struct_alarm_power: ["detection", "alarmPower"],
  struct_alarm_notes: ["detection", "notes"],

  struct_sprinklers: ["suppression", "sprinklers"],
  struct_heads: ["suppression", "heads"],
  struct_perf: ["suppression", "performance"],
  struct_sprinkler_notes: ["suppression", "notes"],

  struct_ext: ["equipment", "extinguishersUsed"],
  struct_ext_count: ["equipment", "extinguishersCount"],
  struct_hose: ["equipment", "hoseReelsUsed"],
  struct_hose_count: ["equipment", "hoseReelsCount"],
  struct_hydrant: ["equipment", "hydrantsUsed"],
  struct_hydrant_count: ["equipment", "hydrantsCount"]
};

  Object.entries(fieldMap).forEach(([id, [section, key]]) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundStruct === "1") return;

    el.dataset.boundStruct = "1";
    const eventName = el.tagName === "SELECT" ? "change" : "input";

    el.addEventListener(eventName, () => {
      if (!state.incident.structure) {
        state.incident.structure = {
          quick: {},
          fireArea: {},
          behaviour: {},
          detection: {},
          suppression: {},
          equipment: {}
        };
      }

      if (!state.incident.structure[section]) {
        state.incident.structure[section] = {};
      }

state.incident.structure[section][key] = String(el.value || "").trim();
applyStructureEquipmentToggles();
saveState();     
applyStructureSectionStates();
    });
  });
}

function loadStructureIntoInputs() {
  const fieldMap = {
    struct_type: ["quick", "type"],
    struct_construction: ["quick", "construction"],
    struct_levels: ["quick", "levels"],
    struct_roof: ["quick", "roof"],
    struct_involved: ["quick", "involved"],
    struct_saved: ["quick", "saved"],

    struct_area_use: ["fireArea", "areaUse"],
    struct_dimensions: ["fireArea", "dimensions"],
    struct_ceiling: ["fireArea", "ceiling"],
    struct_wall: ["fireArea", "wall"],

    struct_smoke_material: ["behaviour", "smokeMaterial"],
    struct_fire_material: ["behaviour", "fireMaterial"],
    struct_smoke_travel: ["behaviour", "smokeTravel"],
    struct_spread: ["behaviour", "spread"],
    struct_smoke_damage: ["behaviour", "smokeDamage"],
    struct_water_damage: ["behaviour", "waterDamage"],

    struct_alarm: ["detection", "alarm"],
    struct_alarm_status: ["detection", "alarmStatus"],
    struct_alarm_power: ["detection", "alarmPower"],
    struct_alarm_notes: ["detection", "notes"],

    struct_sprinklers: ["suppression", "sprinklers"],
    struct_heads: ["suppression", "heads"],
    struct_perf: ["suppression", "performance"],
    struct_sprinkler_notes: ["suppression", "notes"],

    struct_ext: ["equipment", "extinguishersUsed"],
    struct_ext_count: ["equipment", "extinguishersCount"],
    struct_hose: ["equipment", "hoseReelsUsed"],
    struct_hose_count: ["equipment", "hoseReelsCount"],
    struct_hydrant: ["equipment", "hydrantsUsed"],
    struct_hydrant_count: ["equipment", "hydrantsCount"]
  };

  Object.entries(fieldMap).forEach(([id, [section, key]]) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.value = state.incident.structure?.[section]?.[key] || "";
  });

  applyStructureEquipmentToggles();
  applyStructureSectionStates();
}

function applyStructureEquipmentToggles() {
  const pairs = [
    ["struct_ext", "struct_ext_count"],
    ["struct_hose", "struct_hose_count"],
    ["struct_hydrant", "struct_hydrant_count"]
  ];

  pairs.forEach(([selectId, inputId]) => {
    const selectEl = document.getElementById(selectId);
    const inputEl = document.getElementById(inputId);
    if (!selectEl || !inputEl) return;

    const showCount = selectEl.value === "Y";
    inputEl.classList.toggle("hidden", !showCount);

    if (!showCount) {
      inputEl.value = "";

      const fieldMap = {
        struct_ext_count: ["equipment", "extinguishersCount"],
        struct_hose_count: ["equipment", "hoseReelsCount"],
        struct_hydrant_count: ["equipment", "hydrantsCount"]
      };

      const mapping = fieldMap[inputId];
      if (mapping) {
        const [section, key] = mapping;
        if (state.incident.structure?.[section]) {
          state.incident.structure[section][key] = "";
        }
      }
    }
  });
}

function sectionHasAnyValue(sectionName) {
  const section = state.incident.structure?.[sectionName];
  if (!section) return false;

  return Object.values(section).some((value) => String(value || "").trim().length > 0);
}

function applyStructureSectionStates() {
  const map = {
    quick: "Quick Info",
    fireArea: "Fire Area",
    behaviour: "Fire Behaviour",
    detection: "Detection",
    suppression: "Suppression",
    equipment: "Equipment"
  };

  document.querySelectorAll("[data-struct]").forEach((btn) => {
    const key = btn.dataset.struct;
    const complete = sectionHasAnyValue(key);

    btn.classList.toggle("complete", complete);
    btn.classList.toggle("needs-attention", !complete);

    const label = map[key] || key;
    btn.textContent = label;
  });
}

function bindRenderedOtherAgencyEvents() {
  document.querySelectorAll("[data-remove-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.removeAgency;
      state.incident.otherAgencies = (state.incident.otherAgencies || []).filter(
        (agency) => agency.id !== id
      );
      renderOtherAgencies();
      saveState();
    });
  });

  document.querySelectorAll("[data-edit-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const agency = (state.incident.otherAgencies || []).find(
        (item) => item.id === btn.dataset.editAgency
      );
      if (!agency) return;
      agency.expanded = true;
      renderOtherAgencies();
      saveState();
    });
  });

  document.querySelectorAll("[data-save-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const agency = (state.incident.otherAgencies || []).find(
        (item) => item.id === btn.dataset.saveAgency
      );
      if (!agency) return;
      if (isAgencyComplete(agency)) {
        agency.expanded = false;
        renderOtherAgencies();
        saveState();
      }
    });
  });

  document.querySelectorAll(".agency-field").forEach((el) => {
    const eventName = el.tagName === "SELECT" ? "change" : "input";

    if (el.dataset.boundAgencyField === "1") return;
    el.dataset.boundAgencyField = "1";

    el.addEventListener(eventName, () => {
      const agency = (state.incident.otherAgencies || []).find(
        (item) => item.id === el.dataset.agencyId
      );
      if (!agency) return;

      agency[el.dataset.field] = String(el.value || "").trim();

      el.classList.toggle("field-complete", String(el.value || "").trim().length > 0);
      saveState();
    });
  });
}

function bindOperationalChips() {
  bindFlagChip("membersBeforeChip", "membersBefore");
  bindFlagChip("hotDebriefChip", "hotDebrief");
  bindFlagChip("aarRequiredChip", "aarRequired");
  bindFlagChip("injuryChip", "injury");

  const signalChip = document.getElementById("signalChip");
  if (!signalChip || signalChip.dataset.boundClick === "1") return;

  signalChip.dataset.boundClick = "1";
  signalChip.addEventListener("click", () => {
    const active = signalChip.classList.toggle("active");

    if (!active) {
      state.incident.signalCode = "";
      state.incident.signalNotes = "";
    }

    toggleSignalNotes();
    renderSignalChips();
    saveState();
    applyFieldCompletionStates();
  });
}

function bindSignalChips() {
  renderSignalChips();
}

function renderSignalChips() {
  const wrap = document.getElementById("signalWrap");
  if (!wrap) return;

  const chip = document.getElementById("signalChip");
  const active = chip?.classList.contains("active");

  wrap.innerHTML = "";

  if (!active) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");

  const row = document.createElement("div");
  row.className = "chips ops-chip-row";

  SIGNAL_OPTIONS.forEach((code) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip-btn ops-chip ${state.incident.signalCode === code ? "active" : ""}`;
    btn.textContent = code;

    btn.addEventListener("click", () => {
      state.incident.signalCode = state.incident.signalCode === code ? "" : code;
      saveState();
      renderSignalChips();
      toggleSignalNotes();
      applyFieldCompletionStates();
    });

    row.appendChild(btn);
  });

  wrap.appendChild(row);
}

function bindFlagChip(chipId, flagKey) {
  const chip = document.getElementById(chipId);
  if (!chip || chip.dataset.boundClick === "1") return;

  chip.dataset.boundClick = "1";
  chip.addEventListener("click", () => {
    if (!state.incident.flags) {
      state.incident.flags = {};
    }

    state.incident.flags[flagKey] = !state.incident.flags[flagKey];

    if (flagKey === "injury" && !state.incident.flags[flagKey]) {
      state.incident.injuryNotes = "";
    }

    saveState();
    toggleInjuryNotes();
    applyOperationalChipStates();
    applyFieldCompletionStates();
  });
}

function bindDetailTabs() {
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    if (btn.dataset.boundClick === "1") return;
    btn.dataset.boundClick = "1";

    btn.addEventListener("click", () => {
      const tab = String(btn.dataset.detailTab || "").trim().toLowerCase();
      if (!DETAIL_TABS.includes(tab)) return;

      state.incident.activeDetailTab = state.incident.activeDetailTab === tab ? "" : tab;
      saveState();
      applyDetailTabState();
    });
  });
}

function applyDetailTabState() {
  const activeTab = String(state.incident.activeDetailTab || "").trim().toLowerCase();

  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    const tab = String(btn.dataset.detailTab || "").trim().toLowerCase();
    btn.classList.toggle("active", tab === activeTab);
  });

  DETAIL_TABS.forEach((tab) => {
    const panel = document.getElementById(`detailTabPanel-${tab}`);
    if (!panel) return;
    panel.classList.toggle("hidden", tab !== activeTab);
  });
}

function toggleInjuryNotes() {
  const wrap = document.getElementById("injuryNotesWrap");
  if (!wrap) return;

  const show = Boolean(state.incident.flags?.injury);
  wrap.classList.toggle("hidden", !show);

  const input = document.getElementById("injuryNotes");
  if (input && !show) {
    input.value = "";
  }
}

function toggleSignalNotes() {
  const chip = document.getElementById("signalChip");
  const wrap = document.getElementById("signalWrap");
  const notesWrap = document.getElementById("signalNotesWrap");

  const active = chip?.classList.contains("active");
  if (wrap) wrap.classList.toggle("hidden", !active);
  if (notesWrap) notesWrap.classList.toggle("hidden", !(active && state.incident.signalCode));
}

export function loadIncidentIntoInputs() {
  const fieldMap = {
    eventNumber: state.incident.eventNumber,
    pagerDate: state.incident.pagerDate,
    pagerTime: state.incident.pagerTime,
    alertAreaCode: state.incident.alertAreaCode,
    brigadeRole: state.incident.brigadeRole,
    incidentType: state.incident.incidentType,
    responseCode: state.incident.responseCode,
    pagerDetails: state.incident.pagerDetails,
    scannedAddress: state.incident.scannedAddress,
    actualAddress: state.incident.actualAddress,
    controlName: state.incident.controlName,
    firstAgency: state.incident.firstAgency,
    distanceToScene: state.incident.distanceToScene,
    weather1: state.incident.weather1,
    weather2: state.incident.weather2,
    injuryNotes: state.incident.injuryNotes,
    signalNotes: state.incident.signalNotes
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
  });

  renderSceneUnitChips();
  renderOtherAgencies();
  renderSignalChips();
  applyOperationalChipStates();
  toggleInjuryNotes();
  toggleSignalNotes();
  applyDetailTabState();
  applyFieldCompletionStates();
  loadStructureIntoInputs();

  document.dispatchEvent(new Event("incident:loaded"));
}

function applyOperationalChipStates() {
  setChipState("membersBeforeChip", state.incident.flags?.membersBefore);
  setChipState("hotDebriefChip", state.incident.flags?.hotDebrief);
  setChipState("aarRequiredChip", state.incident.flags?.aarRequired);
  setChipState("injuryChip", state.incident.flags?.injury);
  setChipState(
    "signalChip",
    Boolean(state.incident.signalCode) || document.getElementById("signalChip")?.classList.contains("active")
  );
}

function setChipState(id, active) {
  const chip = document.getElementById(id);
  if (!chip) return;
  chip.classList.toggle("active", !!active);
}

export function applyFieldCompletionStates() {
  const requiredIds = [
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
    "firstAgency",
    "distanceToScene",
    "weather1"
  ];

  requiredIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });

  const optionalIds = ["weather2", "controlName", "signalNotes"];
  optionalIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });

  const injuryNotes = document.getElementById("injuryNotes");
  if (injuryNotes) {
    const show = Boolean(state.incident.flags?.injury);
    const value = String(injuryNotes.value || "").trim();
    injuryNotes.classList.toggle("field-complete", show && value.length > 0);
  }
}

function normalizeSceneUnit(raw) {
  const code = String(raw || "").trim().toUpperCase();

  if (code === "AFP" || code === "AFPR" || code === "FP") return "Police";
  return code;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindPanelToggles() {
  const applianceBtn = document.getElementById("tabAddAppliance");
  const agencyBtn = document.getElementById("tabAddAgency");

  const appliancePanel = document.getElementById("appliancePanel");
  const agencyPanel = document.getElementById("agencyPanel");
  const applianceDropdown = document.getElementById("applianceDropdown");
  const agencyDropdown = document.getElementById("agencyDropdown");

  if (!applianceBtn || !agencyBtn || !appliancePanel || !agencyPanel) return;

  if (applianceBtn.dataset.boundClick !== "1") {
    applianceBtn.dataset.boundClick = "1";

    applianceBtn.addEventListener("click", () => {
      const isHidden = appliancePanel.classList.contains("hidden");

      agencyPanel.classList.add("hidden");
      agencyBtn.classList.remove("active");

      if (isHidden) {
        appliancePanel.classList.remove("hidden");
        applianceBtn.classList.add("active");

        if (applianceDropdown) {
          applianceDropdown.focus();

          if (typeof applianceDropdown.showPicker === "function") {
            applianceDropdown.showPicker();
          } else {
            applianceDropdown.click();
          }
        }
      } else {
        appliancePanel.classList.add("hidden");
        applianceBtn.classList.remove("active");
      }
    });
  }

  if (agencyBtn.dataset.boundClick !== "1") {
    agencyBtn.dataset.boundClick = "1";

    agencyBtn.addEventListener("click", () => {
      const isHidden = agencyPanel.classList.contains("hidden");

      appliancePanel.classList.add("hidden");
      applianceBtn.classList.remove("active");

      if (isHidden) {
        agencyPanel.classList.remove("hidden");
        agencyBtn.classList.add("active");

        if (agencyDropdown) {
          agencyDropdown.focus();

          if (typeof agencyDropdown.showPicker === "function") {
            agencyDropdown.showPicker();
          } else {
            agencyDropdown.click();
          }
        }
      } else {
        agencyPanel.classList.add("hidden");
        agencyBtn.classList.remove("active");
      }
    });
  }
}
