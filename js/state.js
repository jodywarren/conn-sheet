export const state = {
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

const STORAGE_KEY = "conn_turnout_state_v3";

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("State save failed", err);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    if (saved.profile) Object.assign(state.profile, saved.profile);
    if (saved.incident) Object.assign(state.incident, saved.incident);

    if (saved.responders) {
      if (saved.responders.members) {
        state.responders.members = saved.responders.members;
      }

      if (saved.responders.appliances) {
        Object.assign(state.responders.appliances, saved.responders.appliances);
      }

      if (saved.responders.oicName) {
        state.responders.oicName = saved.responders.oicName;
      }
    }
  } catch (err) {
    console.warn("State load failed", err);
  }
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
