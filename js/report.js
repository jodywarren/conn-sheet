import { state } from "./state.js";

export function renderReportPreview() {
  const wrap = document.getElementById("reportPreview");
  if (!wrap) return;

  const incident = state.incident;
  const responders = state.responders;

  const lines = [];

  // TITLE
  lines.push("CONNEWARRE FIRE BRIGADE TURNOUT SHEET");
  lines.push("");

  // DATE + TIME
  if (incident.pagerDate || incident.pagerTime) {
    lines.push(`${incident.pagerDate || ""}           ${incident.pagerTime || ""}`);
    lines.push("");
  }

  // PAGER DETAILS
  if (incident.pagerDetails) {
    lines.push(incident.pagerDetails);
    lines.push("");
  }

  // OIC
  if (responders.oicName) {
    lines.push(`Officer in charge: ${responders.oicName}, Connewarre`);
    lines.push("");
  }

  // LOCATION
  if (incident.actualAddress) {
    lines.push(`Actual location: ${incident.actualAddress}`);
  }

  if (incident.controlName) {
    lines.push(`Control name: ${incident.controlName}`);
  }

  // FIRST AGENCY
  if (incident.firstAgency) {
    lines.push(`${incident.firstAgency} were the 1st agency on scene.`);
  }

  // BRIGADES
  if (incident.sceneUnits?.length) {
    lines.push(`Brigades on scene: ${incident.sceneUnits.join(", ")}`);
  }

  // OTHER AGENCIES
  if (incident.otherAgencies?.length) {
    const agencies = incident.otherAgencies
      .map((a) => a.type)
      .filter(Boolean);

    if (agencies.length) {
      lines.push(`Other agencies on scene: ${agencies.join(", ")}`);
    }
  }

  // WEATHER
  if (incident.weather1) {
    let weather = incident.weather1;

    if (incident.weather2) {
      weather += ` and ${incident.weather2}`;
    }

    lines.push(`Weather: ${weather}`);
  }

  // DISTANCE
  if (incident.distanceToScene) {
    lines.push(`Distance to scene: ${incident.distanceToScene} km`);
  }

  // HOSES
  if (incident.hosesUsed) {
    lines.push(`Hoses used: ${incident.hosesUsed}`);
  }

  // COMMENTS
  if (incident.comments) {
    lines.push("");
    lines.push(`Comments: ${incident.comments}`);
  }

  lines.push("");

  // MEMBERS TITLE
  lines.push("MEMBERS RESPONDING");
  lines.push("");

  Object.values(responders.appliances).forEach((appliance) => {
    if (!appliance.crew.length) return;

    const code = appliance.code || "";

    lines.push(`${appliance.label.padEnd(25)} ${code}`);

    appliance.crew.forEach((member) => {
      const roles = [];

      if (member.isDriver) roles.push("Driver");
      if (member.isCrewLeader) roles.push("CL");
      if (member.isOic) roles.push("OIC");
      if (member.isBa) roles.push("BA");

      let line = member.name;

      if (roles.length) {
        line += `: ${roles.join(", ")}`;
      }

      lines.push(line);
    });

    lines.push("");
  });

  // DIRECT RESPONDERS
  if (responders.directResponders?.length) {
    lines.push("Direct");

    responders.directResponders.forEach((member) => {
      const roles = [];

      if (member.isCrewLeader) roles.push("CL");
      if (member.isOic) roles.push("OIC");
      if (member.isBa) roles.push("BA");

      let line = member.name;

      if (roles.length) {
        line += `: ${roles.join(", ")}`;
      }

      lines.push(line);
    });

    lines.push("");
  }

  // FLAGS

  if (incident.flags?.membersBefore) {
    lines.push("There were members direct before 1st appliance");
  }

  if (incident.flags?.hotDebrief) {
    lines.push("Hot debrief conducted");
  }

  if (incident.flags?.aarRequired) {
    lines.push("After action review needed");
  }

  if (incident.flags?.injury && incident.injuryNotes) {
    lines.push(`Injuries - ${incident.injuryNotes}`);
  }

  if (incident.signalCode) {
    let signalLine = `Signal ${incident.signalCode}`;

    if (incident.signalNotes) {
      signalLine += ` - ${incident.signalNotes}`;
    }

    lines.push(signalLine);
  }

  lines.push("");

  // REPORT CREATOR
  lines.push("Report created by:");
  lines.push("Jodie Tuuta, Connewarre, 6404115, 0439517783");

  wrap.textContent = lines.join("\n");
}
