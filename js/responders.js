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
      <button class="secondary-btn" data-action="add-member" data-appliance="${applianceKey}" type="button">Add Member</button>
    </div>

    <div class="crew-list" id="${applianceKey}CrewList">
      ${appliance.crew.map((member) => renderCrewCard(applianceKey, member)).join("")}
    </div>
  `;

  bindAppliancePanelEvents(panel, applianceKey);
}

function getMembersForAppliance(applianceKey) {
  if (applianceKey === "mtdpt") {
    return [
      ...(state.responders.members.conn || []),
      ...(state.responders.members.grov || []),
      ...(state.responders.members.fres || [])
    ];
  }

  return state.responders.members.conn || [];
}

function renderCrewCard(applianceKey, member) {
  return `
    <div class="crew-card" data-member-id="${member.id}">
      <div class="crew-card-top">
        <div>
          <strong>${escapeHtml(member.name)}</strong>
          <div class="subtle">${buildMemberSubline(member)}</div>
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

function buildMemberSubline(member) {
  const parts = [];

  if (member.phone) {
    parts.push(escapeHtml(member.phone));
  }

  const brigadeLabel = getDisplayBrigadeLabel(member.sourceBrigade);
  if (brigadeLabel) {
    parts.push(escapeHtml(brigadeLabel));
  }

  return parts.join(" • ");
}

function bindAppliancePanelEvents(panel, applianceKey) {
  panel.querySelectorAll("[data-action='set-code']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.responders.appliances[applianceKey].code = btn.dataset.code;
      saveState();
      renderRespondersPage();
      focusMemberInput(applianceKey);
    });
  });

  panel.querySelectorAll("[data-action='add-member']").forEach((btn) => {
    btn.addEventListener("click", () => {
      addMemberToAppliance(applianceKey);
    });
  });

  const input = document.getElementById(`${applianceKey}MemberInput`);
  if (input) {
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
      focusMemberInput(applianceKey);
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
        syncOicFromCrew();
      }

      saveState();
      renderRespondersPage();
      focusMemberInput(applianceKey);
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
    focusMemberInput(applianceKey);
    return;
  }

  if (isMemberAlreadyAssigned(selectedName)) {
    window.alert("Member already assigned to another appliance.");
    focusMemberInput(applianceKey);
    return;
  }

  const appliance = state.responders.appliances[applianceKey];
  const alreadyExists = appliance.crew.some(
    (m) => String(m.name || "").trim().toUpperCase() === selectedName
  );

  if (alreadyExists) {
    focusMemberInput(applianceKey);
    return;
  }

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
  focusMemberInput(applianceKey);
}

function getSourceBrigadeForMember(name) {
  const target = String(name || "").trim().toUpperCase();

  if ((state.responders.members.conn || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) {
    return "CONN";
  }
  if ((state.responders.members.grov || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) {
    return "GROV";
  }
  if ((state.responders.members.fres || []).some((m) => String(m.name || "").trim().toUpperCase() === target)) {
    return "FRES";
  }

  return "";
}

function isMemberAlreadyAssigned(targetName) {
  return Object.values(state.responders.appliances).some((appliance) =>
    appliance.crew.some(
      (member) => String(member.name || "").trim().toUpperCase() === targetName
    )
  );
}

function focusMemberInput(applianceKey) {
  setTimeout(() => {
    const input = document.getElementById(`${applianceKey}MemberInput`);
    input?.focus();
  }, 0);
}

function clearAllOic() {
  Object.values(state.responders.appliances).forEach((appliance) => {
    appliance.crew.forEach((member) => {
      member.isOic = false;
    });
  });
}

function syncOicFromCrew() {
  let foundMember = null;

  Object.values(state.responders.appliances).forEach((appliance) => {
    appliance.crew.forEach((member) => {
      if (member.isOic) {
        foundMember = member;
      }
    });
  });

  if (foundMember) {
    state.responders.oicName = foundMember.name || "";
    state.responders.oicPhone = foundMember.phone || "";
  }
}

function getApplianceStatusClass(appliance) {
  if (!appliance.crew.length) return "appliance-empty";

  const hasDriver = appliance.crew.some((member) => member.isDriver);
  if (!hasDriver) return "appliance-warning";

  return "appliance-ready";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDisplayBrigadeLabel(sourceBrigade) {
  const code = String(sourceBrigade || "").trim().toUpperCase();

  if (code === "GROV") return "Grovedale";
  if (code === "FRES") return "Freshwater Creek";
  if (code === "CONN") return "Connewarre";

  return "";
}
