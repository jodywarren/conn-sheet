export const state = {
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
    brigadeCode: "",
    brigadeRole: "",
    incidentType: "",
    pagerDetails: "",
    actualLocation: "",
    controlName: "",
    firsCode: "",
    pagerScreenshot: "",

    brigadesOnScene: [],

    firstAgency: "",
    firstAgencyOther: "",

    weather1: "",
    weather2: "",

    distanceToScene: "",

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

    oicName: ""
  }
};

const STORAGE_KEY = "conn_turnout_state_v4";

export function initState() {
  loadState();
  renderOicBanner();

  const versionTarget = document.getElementById("appVersionText");
  if (versionTarget) {
    versionTarget.textContent = "3.0.0";
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

  if (!state.responders.oicName) {
    banner.textContent = "APPOINT OIC";
    banner.classList.add("missing");
    return;
  }

  banner.textContent = `OIC: ${state.responders.oicName}`;
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

    if (saved.ui) {
      Object.assign(state.ui, saved.ui);
    }

    if (saved.profile) {
      Object.assign(state.profile, saved.profile);
    }

    if (saved.incident) {
      Object.assign(state.incident, saved.incident);

      if (!Array.isArray(state.incident.brigadesOnScene)) {
        state.incident.brigadesOnScene = [];
      }
    }

    if (saved.responders) {
      if (saved.responders.members) {
        state.responders.members = saved.responders.members;
      }

      if (saved.responders.appliances) {
        Object.assign(state.responders.appliances, saved.responders.appliances);
      }

      if (typeof saved.responders.oicName === "string") {
        state.responders.oicName = saved.responders.oicName;
      }
    }
  } catch (err) {
    console.warn("State load failed", err);
  }
}
