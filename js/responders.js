import { state, renderOicBanner, saveState } from "./state.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function initResponders() {
  await loadMembers();
  renderRespondersPage();
}

async function loadMembers() {
  try {
    const [connRes, grovRes, fresRes] = await Promise.all([
      fetch("./CONN.members.json"),
      fetch("./GROV.members.json"),
      fetch("./FRES.members.json")
    ]);

    const connData = await connRes.json();
    const grovData = await grovRes.json();
    const fresData = await fresRes.json();

    state.responders.members = {
      conn: Array.isArray(connData) ? connData : [],
      grov: Array.isArray(grovData) ? grovData : [],
      fres: Array.isArray(fresData) ? fresData : []
    };

    if (!Array.isArray(state.responders.members.fres)) {
      state.responders.members.fres = Array.isArray(fresData) ? fresData : [];
    }
  } catch (error) {
    console.error("Failed to load members:", error);
    state.responders.members = {
      conn: [],
      grov: [],
      fres: []
    };
  }
}

export function renderRespondersPage() {
  renderAppliance("conn1", "conn1Panel");
  renderAppliance("conn2", "conn2Panel");
  renderAppliance("mtdpt", "mtdptPanel");
  renderOtherResponding("otherRespondingPanel");
  renderOicBanner();
}

function renderAppliance(applianceKey, panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const appliance = state.responders.appliances[applianceKey];
  const statusClass = getApplianceStatusClass(appliance);
  const availableMembers = getMembersForAppliance(applianceKey);

  panel.className = `appliance-panel ${statusClass}`;
  panel.innerHTML = `
    <div class="appliance-head">
      <div class="appliance-title">${escapeHtml(appliance.label)}</div>
      <div class="appliance-code-row">
        <button class="chip-btn ${appliance.code === "C1" ? "active" : ""}" data-action="set-code" data-appliance="${applianceKey}" data-code="C1" type="button">Code 1</button>
        <button class="chip-btn ${appliance.code === "C3" ? "active" : ""}" data-action="set-code" data-appliance="${applianceKey}" data-code="C3" type="button">Code 3</button>
        <button class="chip-btn ${appliance.code === "" ? "active" : ""}" data-action="set-code" data-appliance="${applianceKey}" data-code="" type="button">Clear</button>
      </div>
    </div>

       <div class="responder-add-row">
      <input
        class="field-input editable-field"
        id="${applianceKey}MemberInput"
        list="${applianceKey}MemberList"
        type="text"
        placeholder="Type member name"
        autocomplete="off"
      />
      <datalist id="${applianceKey}MemberList">
        ${availableMembers.map((m) => `<option value="${escapeHtml(m.name)}"></option>`).join("")}
      </datalist>
    </div>

    <div class="crew-list" id="${applianceKey}CrewList">
      ${appliance.crew.map((member) => renderCrewCard(applianceKey, member)).join("")}
    </div>
  `;

  bindAppliancePanelEvents(panel, applianceKey);
}

function renderCrewCard(applianceKey, member) {
  return `
    <div class="crew-card" data-member-id="${member.id}">
      <div class="crew-card-top">
        <div>
          <strong>${escapeHtml(member.name)}</strong>
          <div class="subtle">${buildMemberSubline(member.phone, member.sourceBrigade)}</div>
        </div>
        <button class="tiny-btn" data-action="remove-member" data-appliance="${applianceKey}" data-member-id="${member.id}" type="button">Remove</button>
      </div>

      <div class="chips crew-chip-row">
        <button class="chip-btn ${member.isDriver ? "active" : ""}" data-action="toggle-flag" data-appliance="${applianceKey}" data-member-id="${member.id}" data-flag="isDriver" type="button">Driver</button>
        <button class="chip-btn ${member.isCrewLeader ? "active" : ""}" data-action="toggle-flag" data-appliance="${applianceKey}" data-member-id="${member.id}" data-flag="isCrewLeader" type="button">CL</button>
        <button class="chip-btn ${member.isOic ? "active" : ""}" data-action="toggle-flag" data-appliance="${applianceKey}" data-member-id="${member.id}" data-flag="isOic" type="button">OIC</button>
        <button class="chip-btn ${member.isBa ? "active" : ""}" data-action="toggle-flag" data-appliance="${applianceKey}" data-member-id="${member.id}" data-flag="isBa" type="button">BA</button>
        <button class="chip-btn ${member.isInjured ? "active" : ""}" data-action="toggle-flag" data-appliance="${applianceKey}" data-member-id="${member.id}" data-flag="isInjured" type="button">Injured</button>
      </div>
    </div>
  `;
}

function renderOtherResponding(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const allMembers = getAllMembers();
  const showInjuryNotes = hasAnyInjuredResponder();
  const injuryWarning = hasInjuredResponderWithoutNotes()
    ? `<div class="status-banner missing">Warning: A responder is marked injured but no injury notes have been entered.</div>`
    : "";

  panel.className = "appliance-panel";
  panel.innerHTML = `
    <div class="appliance-head">
      <div class="appliance-title">Other Responding</div>
    </div>

       <div class="other-responding-section">
      <div class="subhead">Direct</div>
      <div class="responder-add-row">
        <input
          class="field-input editable-field"
          id="directResponderNameInput"
          list="directResponderNameList"
          type="text"
          placeholder="Type member name"
          autocomplete="off"
        />
        <datalist id="directResponderNameList">
          ${allMembers.map((m) => `<option value="${escapeHtml(m.name)}"></option>`).join("")}
        </datalist>
      </div>

      <div class="crew-list">
        ${state.responders.directResponders.map((member) => renderDirectResponderCard(member)).join("")}
      </div>
    </div>

       <div class="other-responding-section">
      <div class="subhead">Station</div>
      <div class="responder-add-row">
        <input
          class="field-input editable-field"
          id="stationResponderNameInput"
          list="stationResponderNameList"
          type="text"
          placeholder="Type member name"
          autocomplete="off"
        />
        <datalist id="stationResponderNameList">
          ${allMembers.map((m) => `<option value="${escapeHtml(m.name)}"></option>`).join("")}
        </datalist>
      </div>

      <div class="crew-list">
        ${state.responders.stationResponders.map((member) => renderStationResponderCard(member)).join("")}
      </div>
    </div>

       ${showInjuryNotes ? `
    <div class="other-responding-section">
      <div class="subhead">Responder injury notes</div>
      ${injuryWarning}
      <label>
        <textarea
          id="respondersInjuryNotes"
          class="field-input editable-field"
          rows="3"
          placeholder="Enter responder injury details here if any member is marked injured"
        >${escapeHtml(state.responders.injuryNotes || "")}</textarea>
      </label>
    </div>
    ` : ""}
  `;

  bindOtherRespondingEvents(panel);
}

function renderStationResponderCard(member) {
  return `
    <div class="crew-card" data-member-id="${member.id}">
      <div class="crew-card-top">
        <div>
          <strong>${escapeHtml(member.name)}</strong>
        </div>
        <button class="tiny-btn" data-action="remove-station" data-member-id="${member.id}" type="button">Remove</button>
      </div>
    </div>
  `;
}

function renderDirectResponderCard(member) {
  return `
    <div class="crew-card" data-member-id="${member.id}">
      <div class="crew-card-top">
        <div>
          <strong>${escapeHtml(member.name)}</strong>
          <div class="subtle">${escapeHtml(member.number || "")}</div>
        </div>
        <button class="tiny-btn" data-action="remove-direct" data-member-id="${member.id}" type="button">Remove</button>
      </div>

      <div class="chips crew-chip-row">
        <button class="chip-btn ${member.isCrewLeader ? "active" : ""}" data-action="toggle-direct-flag" data-member-id="${member.id}" data-flag="isCrewLeader" type="button">CL</button>
        <button class="chip-btn ${member.isOic ? "active" : ""}" data-action="toggle-direct-flag" data-member-id="${member.id}" data-flag="isOic" type="button">OIC</button>
        <button class="chip-btn ${member.isBa ? "active" : ""}" data-action="toggle-direct-flag" data-member-id="${member.id}" data-flag="isBa" type="button">BA</button>
        <button class="chip-btn ${member.isInjured ? "active" : ""}" data-action="toggle-direct-flag" data-member-id="${member.id}" data-flag="isInjured" type="button">Injured</button>
      </div>
    </div>
  `;
}

function bindAppliancePanelEvents(panel, applianceKey) {
  panel.querySelectorAll("[data-action='set-code']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.responders.appliances[applianceKey].code = btn.dataset.code;
      saveState();
      renderRespondersPage();
    });
  });

  const input = document.getElementById(`${applianceKey}MemberInput`);
  if (input) {
    input.addEventListener("input", () => {
      const selectedName = String(input.value || "").trim().toUpperCase();
      if (!selectedName) return;

      const availableMembers = getMembersForAppliance(applianceKey);
      const exactMatch = availableMembers.find(
        (m) => String(m.name || "").trim().toUpperCase() === selectedName
      );

      if (exactMatch) {
        addMemberToAppliance(applianceKey);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addMemberToAppliance(applianceKey);
      }
    });
  }

  panel.querySelectorAll("[data-action='remove-member']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appliance = state.responders.appliances[applianceKey];
      const memberId = btn.dataset.memberId;
      const removed = appliance.crew.find((m) => m.id === memberId);

      appliance.crew = appliance.crew.filter((m) => m.id !== memberId);

      if (removed?.isOic) {
        state.responders.oicName = "";
        state.responders.oicPhone = "";
      }

      saveState();
      renderRespondersPage();
    });
  });

  panel.querySelectorAll("[data-action='toggle-flag']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appliance = state.responders.appliances[applianceKey];
      const memberId = btn.dataset.memberId;
      const flag = btn.dataset.flag;
      const member = appliance.crew.find((m) => m.id === memberId);
      if (!member) return;

      if (flag === "isDriver") {
        const anotherDriver = appliance.crew.find((m) => m.id !== memberId && m.isDriver);
        if (!member.isDriver && anotherDriver) {
          window.alert(`Driver already selected for ${appliance.label}.`);
          return;
        }
        member.isDriver = !member.isDriver;
      } else if (flag === "isCrewLeader") {
        const anotherCl = appliance.crew.find((m) => m.id !== memberId && m.isCrewLeader);
        if (!member.isCrewLeader && anotherCl) {
          window.alert(`Crew Leader already selected for ${appliance.label}.`);
          return;
        }
        member.isCrewLeader = !member.isCrewLeader;
      } else if (flag === "isOic") {
        const turningOn = !member.isOic;
        clearAllOic();

        if (turningOn) {
          member.isOic = true;
          state.responders.oicName = member.name || "";
          state.responders.oicPhone = member.phone || "";
        } else {
          member.isOic = false;
          state.responders.oicName = "";
          state.responders.oicPhone = "";
        }
      } else if (flag === "isBa") {
        member.isBa = !member.isBa;
      } else if (flag === "isInjured") {
        member.isInjured = !member.isInjured;
      }

      if (flag !== "isOic") {
        syncOicFromAllResponse();
      }

      saveState();
      renderRespondersPage();
    });
  });
}

function bindOtherRespondingEvents(panel) {
  const stationNameInput = document.getElementById("stationResponderNameInput");

  if (stationNameInput) {
    stationNameInput.addEventListener("input", () => {
      const selectedName = String(stationNameInput.value || "").trim().toUpperCase();
      if (!selectedName) return;

      const allMembers = getAllMembers();
      const exactMatch = allMembers.find(
        (m) => String(m.name || "").trim().toUpperCase() === selectedName
      );

      if (exactMatch) {
        addStationResponder();
      }
    });

    stationNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addStationResponder();
      }
    });
  } 

   const directNameInput = document.getElementById("directResponderNameInput");

  if (directNameInput) {
    directNameInput.addEventListener("input", () => {
      const selectedName = String(directNameInput.value || "").trim().toUpperCase();
      if (!selectedName) return;

      const allMembers = getAllMembers();
      const exactMatch = allMembers.find(
        (m) => String(m.name || "").trim().toUpperCase() === selectedName
      );

      if (exactMatch) {
        addDirectResponder();
      }
    });

    directNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addDirectResponder();
      }
    });
  }
  
  const injuryNotes = document.getElementById("respondersInjuryNotes");
  if (injuryNotes) {
    injuryNotes.addEventListener("input", () => {
      state.responders.injuryNotes = injuryNotes.value.trim();
      saveState();
    });
  }

  panel.querySelectorAll("[data-action='remove-station']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const memberId = btn.dataset.memberId;
      state.responders.stationResponders = state.responders.stationResponders.filter((m) => m.id !== memberId);
      saveState();
      renderRespondersPage();
    });
  });

  panel.querySelectorAll("[data-action='remove-direct']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const memberId = btn.dataset.memberId;
      const removed = state.responders.directResponders.find((m) => m.id === memberId);
      state.responders.directResponders = state.responders.directResponders.filter((m) => m.id !== memberId);

      if (removed?.isOic) {
        state.responders.oicName = "";
        state.responders.oicPhone = "";
      }

      saveState();
      renderRespondersPage();
    });
  });

  panel.querySelectorAll("[data-action='toggle-direct-flag']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const memberId = btn.dataset.memberId;
      const flag = btn.dataset.flag;
      const member = state.responders.directResponders.find((m) => m.id === memberId);
      if (!member) return;

      if (flag === "isCrewLeader") {
        member.isCrewLeader = !member.isCrewLeader;
      } else if (flag === "isOic") {
        const turningOn = !member.isOic;
        clearAllOic();

        if (turningOn) {
          member.isOic = true;
          state.responders.oicName = member.name || "";
          state.responders.oicPhone = member.number || "";
        } else {
          member.isOic = false;
          state.responders.oicName = "";
          state.responders.oicPhone = "";
        }
      } else if (flag === "isBa") {
        member.isBa = !member.isBa;
      } else if (flag === "isInjured") {
        member.isInjured = !member.isInjured;
      }

      if (flag !== "isOic") {
        syncOicFromAllResponse();
      }

      saveState();
      renderRespondersPage();
    });
  });
}

function addMemberToAppliance(applianceKey) {
  const input = document.getElementById(`${applianceKey}MemberInput`);
  const selectedName = input?.value.trim().toUpperCase() || "";
  if (!selectedName) return;

  const availableMembers = getMembersForAppliance(applianceKey);
  const memberData = availableMembers.find(
    (m) => String(m.name || "").trim().toUpperCase() === selectedName
  );

  if (!memberData) {
    window.alert("Select a valid member from the list.");
    return;
  }

  if (isMemberAlreadyAssignedAnywhere(selectedName)) {
    window.alert("Member already assigned elsewhere.");
    return;
  }

  const appliance = state.responders.appliances[applianceKey];
  appliance.crew.push({
    id: uid(),
    name: memberData.name,
    phone: memberData.phone || "",
    sourceBrigade: getSourceBrigadeForMember(memberData.name),
    isDriver: false,
    isCrewLeader: false,
    isOic: false,
    isBa: false,
    isInjured: false
  });

  if (input) input.value = "";

  saveState();
  renderRespondersPage();

  setTimeout(() => {
    const field = document.getElementById(`${applianceKey}MemberInput`);
    field?.focus();
  }, 0);
}

function addStationResponder() {
  const nameInput = document.getElementById("stationResponderNameInput");
  const name = String(nameInput?.value || "").trim();

  if (!name) return;
  if (isMemberAlreadyAssignedAnywhere(name.toUpperCase())) {
    window.alert("Member already assigned elsewhere.");
    return;
  }

  const matched = findMemberByName(name);

  if (!matched) {
    window.alert("Select a valid member from the list.");
    return;
  }

  state.responders.stationResponders.push({
    id: uid(),
    name: matched.name
  });

  if (nameInput) nameInput.value = "";

  saveState();
  renderRespondersPage();

  setTimeout(() => {
    const field = document.getElementById("stationResponderNameInput");
    field?.focus();
  }, 0);
}

function addDirectResponder() {
  const nameInput = document.getElementById("directResponderNameInput");
  const name = String(nameInput?.value || "").trim();

  if (!name) return;
  if (isMemberAlreadyAssignedAnywhere(name.toUpperCase())) {
    window.alert("Member already assigned elsewhere.");
    return;
  }

  const matched = findMemberByName(name);

  if (!matched) {
    window.alert("Select a valid member from the list.");
    return;
  }

  state.responders.directResponders.push({
    id: uid(),
    name: matched.name,
    number: matched.phone || "",
    isCrewLeader: false,
    isOic: false,
    isBa: false,
    isInjured: false
  });

  if (nameInput) nameInput.value = "";

  saveState();
  renderRespondersPage();

  setTimeout(() => {
    const field = document.getElementById("directResponderNameInput");
    field?.focus();
  }, 0);
}

function getMembersForAppliance(applianceKey) {
  if (applianceKey === "mtdpt") {
    return getAllMembers();
  }
  return state.responders.members.conn || [];
}

function getAllMembers() {
  return [
    ...(state.responders.members.conn || []),
    ...(state.responders.members.grov || []),
    ...(state.responders.members.fres || [])
  ];
}

function findMemberByName(name) {
  const target = String(name || "").trim().toUpperCase();
  return getAllMembers().find((m) => String(m.name || "").trim().toUpperCase() === target) || null;
}

function getSourceBrigadeForMember(name) {
  const target = String(name || "").trim().toUpperCase();

  if ((state.responders.members.conn || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) return "CONN";
  if ((state.responders.members.grov || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) return "GROV";
  if ((state.responders.members.fres || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) return "FRES";

  return "";
}

function isMemberAlreadyAssignedAnywhere(targetName) {
  const upper = String(targetName || "").trim().toUpperCase();

  const inAppliances = Object.values(state.responders.appliances).some((appliance) =>
    appliance.crew.some((member) => String(member.name || "").trim().toUpperCase() === upper)
  );

  const inStation = (state.responders.stationResponders || []).some(
    (member) => String(member.name || "").trim().toUpperCase() === upper
  );

  const inDirect = (state.responders.directResponders || []).some(
    (member) => String(member.name || "").trim().toUpperCase() === upper
  );

  return inAppliances || inStation || inDirect;
}

function clearAllOic() {
  Object.values(state.responders.appliances).forEach((appliance) => {
    appliance.crew.forEach((member) => {
      member.isOic = false;
    });
  });

  (state.responders.directResponders || []).forEach((member) => {
    member.isOic = false;
  });
}

function syncOicFromAllResponse() {
  let found = null;

  Object.values(state.responders.appliances).forEach((appliance) => {
    appliance.crew.forEach((member) => {
      if (member.isOic) {
        found = { name: member.name || "", number: member.phone || "" };
      }
    });
  });

  if (!found) {
    (state.responders.directResponders || []).forEach((member) => {
      if (member.isOic) {
        found = { name: member.name || "", number: member.number || "" };
      }
    });
  }

  if (found) {
    state.responders.oicName = found.name;
    state.responders.oicPhone = found.number;
  } else {
    state.responders.oicName = "";
    state.responders.oicPhone = "";
  }
}

function hasAnyInjuredResponder() {
  const applianceInjury = Object.values(state.responders.appliances || {}).some((appliance) =>
    (appliance.crew || []).some((member) => member.isInjured)
  );

  const directInjury = (state.responders.directResponders || []).some((member) => member.isInjured);

  return applianceInjury || directInjury;
}

function hasInjuredResponderWithoutNotes() {
  return hasAnyInjuredResponder() && !String(state.responders.injuryNotes || "").trim();
}

function getApplianceStatusClass(appliance) {
  if (!appliance.crew.length) return "appliance-empty";
  const hasDriver = appliance.crew.some((member) => member.isDriver);
  if (!hasDriver) return "appliance-warning";
  return "appliance-ready";
}

function buildMemberSubline(phone, sourceBrigade) {
  const parts = [];
  if (phone) parts.push(escapeHtml(phone));

  const brigadeLabel = getDisplayBrigadeLabel(sourceBrigade);
  if (brigadeLabel) parts.push(escapeHtml(brigadeLabel));

  return parts.join(" • ");
}

function getDisplayBrigadeLabel(sourceBrigade) {
  const code = String(sourceBrigade || "").trim().toUpperCase();
  if (code === "GROV") return "Grovedale";
  if (code === "FRES") return "Freshwater Creek";
  if (code === "CONN") return "Connewarre";
  return "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
