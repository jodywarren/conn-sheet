function createDefaultState() {
  return {
    ui: {
      currentPage: "incidentPage"
    },

    profile: {
      name: "",
      brigade: "Connewarre",
      memberNumber: "",
      contactNumber: "",
      email: ""
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

      sceneUnits: [],
      pagedSceneUnits: [],

      firstAgency: "",
      firstAgencyOther: "",

      weather1: "",
      weather2: "",

      distanceToScene: "",

      stopMessageReceived: false,

      hoses: {
        hose64Qty: "0",
        hose38Qty: "0",
        hose25Qty: "0",
        hoseOtherType: ""
      },

      comments: "",
      injuryNotes: "",

      flags: {
        membersBefore: false,
        aar: false,
        hotDebrief: false
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

      oicName: "",
      oicPhone: ""
    }
  };
}

export const state = createDefaultState();

const STORAGE_KEY = "conn_turnout_state_v6";

export function initState() {
  loadState();
  renderOicBanner();

  const versionTarget = document.getElementById("appVersionText");
  if (versionTarget) {
    versionTarget.textContent = "3.2.0";
  }
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
  saveState();
}

export function fillProfileInputs() {
  const nameEl = document.getElementById("profileName");
  const memberEl = document.getElementById("profileMemberNumber");
  const contactEl = document.getElementById("profileContactNumber");
  const emailEl = document.getElementById("profileEmail");
  const brigadeEl = document.getElementById("profileBrigade");

  if (nameEl) nameEl.value = state.profile.name || "";
  if (memberEl) memberEl.value = state.profile.memberNumber || "";
  if (contactEl) contactEl.value = state.profile.contactNumber || "";
  if (emailEl) emailEl.value = state.profile.email || "";
  if (brigadeEl) brigadeEl.value = state.profile.brigade || "Connewarre";
}

export function renderOicBanner() {
  const banner = document.getElementById("oicBanner");
  if (!banner) return;

  const name = String(state.responders.oicName || "").trim();
  const phone = String(state.responders.oicPhone || "").trim();

  if (!name) {
    banner.textContent = "APPOINT OIC";
    banner.classList.add("missing");
    return;
  }

  if (!phone) {
    banner.textContent = `OIC: ${name} • Number missing`;
    banner.classList.add("missing");
    return;
  }

  banner.textContent = `OIC: ${name} • ${phone}`;
  banner.classList.remove("missing");
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

    if (saved.ui) Object.assign(fresh.ui, saved.ui);
    if (saved.profile) Object.assign(fresh.profile, saved.profile);

    if (saved.incident) {
      Object.assign(fresh.incident, saved.incident);

      if (saved.incident.hoses) {
        Object.assign(fresh.incident.hoses, saved.incident.hoses);
      }

      if (saved.incident.flags) {
        Object.assign(fresh.incident.flags, saved.incident.flags);
      }

      if (!Array.isArray(fresh.incident.sceneUnits)) {
        const legacy = [];
        if (Array.isArray(saved.incident.brigadesOnScene)) {
          legacy.push(...saved.incident.brigadesOnScene);
        }
        if (Array.isArray(saved.incident.otherUnitsOnScene)) {
          legacy.push(...saved.incident.otherUnitsOnScene);
        }
        fresh.incident.sceneUnits = [...new Set(legacy)];
      }

      if (!Array.isArray(fresh.incident.pagedSceneUnits)) {
        fresh.incident.pagedSceneUnits = [...fresh.incident.sceneUnits];
      }

      if (!fresh.incident.actualAddress && saved.incident.actualLocation) {
        fresh.incident.actualAddress = saved.incident.actualLocation;
      }

      if (!fresh.incident.scannedAddress && saved.incident.actualLocation) {
        fresh.incident.scannedAddress = saved.incident.actualLocation;
      }

      if (!fresh.incident.alertAreaCode && saved.incident.brigadeCode) {
        fresh.incident.alertAreaCode = saved.incident.brigadeCode;
      }

      if (!fresh.incident.primaryBrigade && fresh.incident.alertAreaCode) {
        fresh.incident.primaryBrigade = String(fresh.incident.alertAreaCode).replace(/\d+/g, "");
      }

      if (!fresh.incident.brigadeRole && fresh.incident.primaryBrigade) {
        fresh.incident.brigadeRole =
          fresh.incident.primaryBrigade === "CONN"
            ? "Primary"
            : `Support to ${fresh.incident.primaryBrigade}`;
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
