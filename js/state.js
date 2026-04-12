function createDefaultState() {
  return {
    ui: {
      currentPage: "incidentPage",
      theme: "light"
    },

  profile: {
  name: "",
  brigade: "Connewarre",
  memberNumber: "",
  contactNumber: "",
  email: "",

  station1: {
    name: "Connewarre",
    lat: -38.265192,
    lng: 144.398106
  },

  station2: {
    name: "Mt Duneed",
    lat: -38.249978,
    lng: 144.351697
  }
}, 

    incident: {
      eventNumber: "",
      pagerDate: "",
      pagerTime: "",

      alertAreaCode: "",
      primaryBrigade: "",
      brigadeRole: "",

      incidentCodeRaw: "",
      incidentType: "",
      responseCode: "",

      pagerDetails: "",

      scannedAddress: "",
      actualAddress: "",
      actualAddressEdited: false,

      controlName: "",
      firsCode: "",
      pagerScreenshot: "",

      mva: {
      vehicles: [],
      hazards: [],
      outcome: "",
      notes: ""
      },

      alarm: {
   type: "",
   cause: "",
   outcome: "",
   notes: "",
   photo: ""
 },
      
      sceneUnits: [],
      pagedSceneUnits: [],

      firstAgency: "",
      distanceToScene: "",
      weather1: "",
      weather2: "",

      otherAgencies: [],

          flags: {
        membersBefore: false,
        hotDebrief: false,
        aarRequired: false,
        injury: false,
        cancelledEnroute: false
      },
      },

      injuryNotes: "",
      signalCode: "",
      signalNotes: "",

      comments: "",
      hosesUsed: "",

      activeDetailTab: "",

structure: {
  quick: {},
  fireArea: {},
  behaviour: {},
  detection: {},
  suppression: {},
  equipment: {}
}
    },

    responders: {
      members: {
        conn: [],
        grov: [],
        fres: []
      },

      appliances: {
        conn1: {
          label: "CONN 1",
          code: "",
          crew: []
        },
        conn2: {
          label: "CONN 2",
          code: "",
          crew: []
        },
        mtdpt: {
          label: "MTD P/T",
          code: "",
          crew: []
        }
      },

      stationResponders: [],
      directResponders: [],

      injuryNotes: "",

      oicName: "",
      oicPhone: ""
    }
  };
}

export const state = createDefaultState();
const STORAGE_KEY = "conn_turnout_state_v8";

export function initState() {
  loadState();
  renderOicBanner();
  applyTheme();

  const versionTarget = document.getElementById("appVersionText");
  if (versionTarget) {
    versionTarget.textContent = "3.4.0";
  }
}

export function resetState() {
  const fresh = createDefaultState();

  state.ui.currentPage = "incidentPage";

  // Keep theme and profile. Clear current job only.
  state.incident = fresh.incident;

  // Preserve loaded member lists, reset response content only.
  state.responders = {
    members: state.responders.members || fresh.responders.members,
    appliances: createDefaultState().responders.appliances,
    stationResponders: [],
    directResponders: [],
    injuryNotes: "",
    oicName: "",
    oicPhone: ""
  };

  saveState();
  renderOicBanner();
}

export function setCurrentPage(pageId) {
  state.ui.currentPage = pageId;
  saveState();
}

export function saveProfileFromInputs() {
  state.profile.name = document.getElementById("profileName")?.value.trim() || "";
  state.profile.memberNumber = document.getElementById("profileMemberNumber")?.value.trim() || "";
  state.profile.contactNumber = document.getElementById("profileContactNumber")?.value.trim() || "";
  state.profile.email = document.getElementById("profileEmail")?.value.trim() || "";
  state.profile.brigade = document.getElementById("profileBrigade")?.value.trim() || "Connewarre";
  state.ui.theme = document.getElementById("themeToggle")?.checked ? "dark" : "light";
  if (!state.profile.station1) {
    state.profile.station1 = { name: "Connewarre", lat: 0, lng: 0 };
  }
  if (!state.profile.station2) {
    state.profile.station2 = { name: "Mt Duneed", lat: 0, lng: 0 };
  }

if (!state.profile.station1) {
  state.profile.station1 = { name: "Connewarre", lat: 0, lng: 0 };
}
if (!state.profile.station2) {
  state.profile.station2 = { name: "Mt Duneed", lat: 0, lng: 0 };
}

state.profile.station1.lat = parseFloat(document.getElementById("station1Lat")?.value) || 0;
state.profile.station1.lng = parseFloat(document.getElementById("station1Lng")?.value) || 0;

state.profile.station2.lat = parseFloat(document.getElementById("station2Lat")?.value) || 0;
state.profile.station2.lng = parseFloat(document.getElementById("station2Lng")?.value) || 0;
  applyTheme();
  saveState();
}

export function fillProfileInputs() {
  const nameEl = document.getElementById("profileName");
  const memberEl = document.getElementById("profileMemberNumber");
  const contactEl = document.getElementById("profileContactNumber");
  const emailEl = document.getElementById("profileEmail");
  const brigadeEl = document.getElementById("profileBrigade");
  const themeToggle = document.getElementById("themeToggle");

  if (nameEl) nameEl.value = state.profile.name || "";
  if (memberEl) memberEl.value = state.profile.memberNumber || "";
  if (contactEl) contactEl.value = state.profile.contactNumber || "";
  if (emailEl) emailEl.value = state.profile.email || "";
  if (brigadeEl) brigadeEl.value = state.profile.brigade || "Connewarre";
  if (themeToggle) themeToggle.checked = state.ui.theme === "dark";

  const s1Lat = document.getElementById("station1Lat");
const s1Lng = document.getElementById("station1Lng");
const s2Lat = document.getElementById("station2Lat");
const s2Lng = document.getElementById("station2Lng");

if (s1Lat) s1Lat.value = state.profile.station1?.lat ?? "";
if (s1Lng) s1Lng.value = state.profile.station1?.lng ?? "";
if (s2Lat) s2Lat.value = state.profile.station2?.lat ?? "";
if (s2Lng) s2Lng.value = state.profile.station2?.lng ?? "";
}

export function renderOicBanner() {
  const banner = document.getElementById("oicBanner");
  if (!banner) return;

  const name = String(state.responders.oicName || "").trim().toUpperCase();
  const phone = String(state.responders.oicPhone || "").trim();

  banner.classList.remove("missing", "complete");

  if (!name) {
    banner.textContent = "APPOINT OIC";
    banner.classList.add("missing");
    return;
  }

  const line1 = `OIC: ${name}`;
  const line2 = phone || "";

  banner.innerHTML = line2
    ? `${line1}<br>${line2}`
    : line1;

  banner.classList.add("complete");
}

export function applyTheme() {
  document.body.classList.toggle("dark-mode", state.ui.theme === "dark");
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const meta = document.getElementById("draftMeta");
    if (meta) {
      meta.textContent = `Autosaved ${new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    }
  } catch (err) {
    console.warn("State save failed", err);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    const fresh = createDefaultState();

    if (saved.ui) {
      Object.assign(fresh.ui, saved.ui);
    }

    if (saved.profile) {
      Object.assign(fresh.profile, saved.profile);
    }

    if (saved.incident) {
      Object.assign(fresh.incident, saved.incident);

      if (saved.incident.flags) {
        Object.assign(fresh.incident.flags, saved.incident.flags);
      }

      if (!Array.isArray(fresh.incident.sceneUnits)) {
        fresh.incident.sceneUnits = [];
      }

      if (!Array.isArray(fresh.incident.pagedSceneUnits)) {
        fresh.incident.pagedSceneUnits = [...fresh.incident.sceneUnits];
      }

      if (!Array.isArray(fresh.incident.otherAgencies)) {
        fresh.incident.otherAgencies = [];
      }

      if (typeof fresh.incident.activeDetailTab !== "string") {
        fresh.incident.activeDetailTab = "";
      }
    }

    if (saved.responders) {
      if (saved.responders.members) {
        fresh.responders.members = saved.responders.members;
      }

      if (saved.responders.appliances) {
        Object.assign(fresh.responders.appliances, saved.responders.appliances);
      }

      if (Array.isArray(saved.responders.stationResponders)) {
        fresh.responders.stationResponders = saved.responders.stationResponders;
      }

      if (Array.isArray(saved.responders.directResponders)) {
        fresh.responders.directResponders = saved.responders.directResponders;
      }

      if (typeof saved.responders.injuryNotes === "string") {
        fresh.responders.injuryNotes = saved.responders.injuryNotes;
      }

      if (typeof saved.responders.oicName === "string") {
        fresh.responders.oicName = saved.responders.oicName;
      }

      if (typeof saved.responders.oicPhone === "string") {
        fresh.responders.oicPhone = saved.responders.oicPhone;
      }
    }

    Object.assign(state.ui, fresh.ui);
    Object.assign(state.profile, fresh.profile);
    Object.assign(state.incident, fresh.incident);
    Object.assign(state.responders, fresh.responders);
  } catch (err) {
    console.warn("State load failed", err);
  }
}
