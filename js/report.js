import { state } from "./state.js";

function formatAgencyLine(firstAgency) {
  if (!firstAgency) return "";
  return `1st agency on scene: ${firstAgency}`;
}

function formatDistance(distance) {
  if (!distance) return "";
  return String(distance).replace(/\s*KM$/i, "km").replace(/\s+/g, "");
}

function formatApplianceLabel(label) {
  const raw = String(label || "").trim().toUpperCase();

  if (raw === "CONN 1") return "CONN TANKER 1";
  if (raw === "CONN 2") return "CONN TANKER 2";
  if (raw === "MTD P/T") return "MOUNT DUNEED P/T";

  return raw;
}

function buildCrewLine(member) {
  const roles = [];

  if (member.isDriver) roles.push("Driver");
  if (member.isCrewLeader) roles.push("CL");
  if (member.isOic) roles.push("OIC");
  if (member.isBa) roles.push("BA");

  let line = member.name || "";

  if (roles.length) {
    line += `: ${roles.join(", ")}`;
  }

  return line;
}

function getOtherAgencySummary(agency) {
  const parts = [];

  if (agency.type) parts.push(agency.type);
  if (agency.name) parts.push(agency.name);
  if (agency.station) parts.push(agency.station);
  if (agency.localHq) parts.push(agency.localHq);
  if (agency.office) parts.push(agency.office);
  if (agency.contactNumber) parts.push(agency.contactNumber);

  if (agency.badgeNumber) parts.push(`Badge ${agency.badgeNumber}`);
  if (agency.idNumber) parts.push(`ID ${agency.idNumber}`);

  return parts.join(", ");
}

function hasAnyResponderInjury() {
  const applianceInjury = Object.values(state.responders.appliances || {}).some((appliance) =>
    (appliance.crew || []).some((member) => member.isInjured)
  );

  const directInjury = (state.responders.directResponders || []).some((member) => member.isInjured);

  return applianceInjury || directInjury;
}

export function renderReportPreview() {
  const wrap = document.getElementById("reportPreview");
  if (!wrap) return;

  const incident = state.incident;
  const responders = state.responders;

  const lines = [];

  lines.push("CONNEWARRE FIRE BRIGADE TURNOUT SHEET");
  lines.push("");

  if (incident.pagerDetails) {
    lines.push(incident.pagerDetails);
    lines.push("");
  }

  if (responders.oicName) {
    const oicParts = [responders.oicName, "CONNEWARRE"];
    if (responders.oicPhone) oicParts.push(responders.oicPhone);
    lines.push(`Officer in charge: ${oicParts.join(", ")}`);
    lines.push("");
  }

  if (incident.actualAddress) {
    lines.push(`Actual location: ${incident.actualAddress}`);
  }

  if (incident.controlName) {
    lines.push(`Control name: ${incident.controlName}`);
  }

  const agencyLine = formatAgencyLine(incident.firstAgency);
  if (agencyLine) {
    lines.push(agencyLine);
  }

  if (incident.sceneUnits?.length) {
    lines.push(`Brigades on scene: ${incident.sceneUnits.join(", ")}`);
  }

  if (incident.otherAgencies?.length) {
    const selectedAgencyTypes = incident.otherAgencies
      .map((a) => a.type)
      .filter(Boolean);

    if (selectedAgencyTypes.length) {
      lines.push(`Other agencies on scene: ${selectedAgencyTypes.join(", ")}`);
    }
  }

  if (incident.weather1) {
    let weather = incident.weather1;
    if (incident.weather2) weather += ` and ${incident.weather2}`;
    lines.push(`Weather: ${weather}`);
  }

  if (incident.distanceToScene) {
    lines.push(`Distance to scene: ${formatDistance(incident.distanceToScene)}`);
  }

  if (incident.hosesUsed) {
    lines.push(`Hoses used: ${incident.hosesUsed}`);
  }

  if (incident.comments) {
    lines.push(`Comments: ${incident.comments}`);
  }

  lines.push("");
  lines.push("MEMBERS RESPONDING");
  lines.push("");

  Object.values(responders.appliances || {}).forEach((appliance) => {
    if (!appliance.crew?.length) return;

    const applianceLabel = formatApplianceLabel(appliance.label);
    const code = appliance.code ? appliance.code.toUpperCase().replace(/^C/, "CODE ") : "";
    lines.push(`${applianceLabel.padEnd(28)} ${code}`.trimEnd());

    appliance.crew.forEach((member) => {
      lines.push(buildCrewLine(member));
    });

    lines.push("");
  });

  if (responders.directResponders?.length) {
    lines.push("DIRECT");

    responders.directResponders.forEach((member) => {
      lines.push(buildCrewLine(member));
    });

    lines.push("");
  }

  if (responders.stationResponders?.length) {
    lines.push("STATION");

    responders.stationResponders.forEach((member) => {
      lines.push(member.name || "");
    });

    lines.push("");
  }

  if (incident.otherAgencies?.length) {
    const agenciesWithInfo = incident.otherAgencies.filter((agency) => {
      return Boolean(
        agency.type ||
        agency.agencyName ||
        agency.name ||
        agency.contactNumber ||
        agency.badgeNumber ||
        agency.idNumber ||
        agency.station ||
        agency.localHq ||
        agency.office ||
        agency.notes
      );
    });

    agenciesWithInfo.forEach((agency) => {
      const summary = getOtherAgencySummary(agency);
      if (summary) lines.push(`Other: ${summary}`);
      if (agency.notes) lines.push(`Notes: ${agency.notes}`);
      lines.push("");
    });
  }

  if (hasAnyResponderInjury()) {
    if (responders.injuryNotes) {
      lines.push(`Injuries - ${responders.injuryNotes}`);
    } else {
      lines.push("Injuries - NOTE MISSING");
    }
  }

  if (incident.flags?.membersBefore) {
    lines.push("There were members direct before 1st appliance");
  }

  if (incident.flags?.hotDebrief) {
    lines.push("Hot debrief conducted");
  }

  if (incident.flags?.aarRequired) {
    lines.push("After action review needed");
  }

  if (incident.signalCode) {
    let signalLine = `Signal ${incident.signalCode}`;
    if (incident.signalNotes) signalLine += ` - ${incident.signalNotes}`;
    lines.push(signalLine);
  }

  lines.push("");
  lines.push("REPORT CREATED BY:");
  lines.push("Jodie Tuuta, Connewarre, 6404115, 0439517783");

  wrap.textContent = lines.join("\n");
}
