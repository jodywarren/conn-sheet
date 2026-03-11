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
  const versionEl = document.getElementById("appVersionText");
  if (versionEl) versionEl.textContent = state.config.appVersion;
  renderOicBanner();
}

export function setCurrentPage(pageId) {
  state.ui.currentPage = pageId;
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
