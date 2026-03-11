export const STORAGE_KEY = "conn_sheet_state_v1";

export const state = {
  config: {
    appVersion: "3.0.0"
  },

  ui: {
    currentPage: "incidentPage",
    settingsOpen: false
  },

  profile: {
    name: "",
    memberNumber: "",
    contactNumber: "",
    email: "",
    brigade: "Connewarre"
  },

  responders: {
    oicName: "",
    members: [],
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
    }
  },

  incident: {
    eventNumber: "",
    pagerDate: "",
    pagerTime: "",
    brigadeCode: "",
    incidentType: "",
    pagerDetails: "",
    actualLocation: "",
    controlName: "",
    firstAgency: "",
    brigadesOnScene: [],
    weather1: "",
    weather2: "",
    distanceToScene: "",
    hoses: {
      hose64: 0,
      hose38: 0,
      hose25: 0,
      other: ""
    }
  }
};

export function initState() {
  loadState();

  const versionEl = document.getElementById("appVersionText");
  if (versionEl) versionEl.textContent = state.config.appVersion;

  renderOicBanner();
}

export function setCurrentPage(pageId) {
  state.ui.currentPage = pageId;
  saveState();
}

export function openSettings() {
  state.ui.settingsOpen = true;
}

export function closeSettings() {
  state.ui.settingsOpen = false;
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

  if (nameEl) nameEl.value = state.profile.name;
  if (memberEl) memberEl.value = state.profile.memberNumber;
  if (contactEl) contactEl.value = state.profile.contactNumber;
  if (emailEl) emailEl.value = state.profile.email;
  if (brigadeEl) brigadeEl.value = state.profile.brigade;
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
  const payload = {
    ui: {
      currentPage: state.ui.currentPage
    },
    profile: structuredClone(state.profile),
    responders: {
      oicName: state.responders.oicName,
      appliances: structuredClone(state.responders.appliances)
    },
    incident: structuredClone(state.incident)
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  const meta = document.getElementById("draftMeta");
  if (meta) {
    meta.textContent = `Autosaved ${new Date().toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    if (saved.ui?.currentPage) state.ui.currentPage = saved.ui.currentPage;
    if (saved.profile) Object.assign(state.profile, saved.profile);
    if (saved.responders?.oicName !== undefined) state.responders.oicName = saved.responders.oicName;

    if (saved.responders?.appliances) {
      Object.keys(state.responders.appliances).forEach((key) => {
        if (saved.responders.appliances[key]) {
          state.responders.appliances[key].code = saved.responders.appliances[key].code || "";
          state.responders.appliances[key].crew = Array.isArray(saved.responders.appliances[key].crew)
            ? saved.responders.appliances[key].crew
            : [];
        }
      });
    }

    if (saved.incident) {
      Object.assign(state.incident, saved.incident);

      if (saved.incident.hoses) {
        state.incident.hoses = {
          hose64: saved.incident.hoses.hose64 || 0,
          hose38: saved.incident.hoses.hose38 || 0,
          hose25: saved.incident.hoses.hose25 || 0,
          other: saved.incident.hoses.other || ""
        };
      }

      if (!Array.isArray(state.incident.brigadesOnScene)) {
        state.incident.brigadesOnScene = [];
      }
    }
  } catch (error) {
    console.error("Failed to load saved state:", error);
  }
}
