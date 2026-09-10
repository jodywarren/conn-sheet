import { state, saveState } from "./state.js";

const INCIDENT_TYPES = [
  ["134", "Power pole fire including transformers, power or utility vaults, utility equipment fires"],
  ["138", "Outside cooking equipment fire, includes BBQ’s, spit roaster etc. for uncontrolled fires only"],
  ["121", "Foodstuffs burnt, confined to cooking equipment"],
  ["123", "Incinerator fire - confined"],
  ["124", "Oil burner delayed ignition, malfunction or misuse – confined"],
  ["125", "Compactor fire - confined to rubbish"],
  ["151", "Passenger vehicle fire including buses"],
  ["152", "Road or transport vehicle fire"],
  ["153", "Rail vehicle fire"],
  ["154", "Water vessel fire"],
  ["155", "Aircraft fire"],
  ["156", "Camper, caravan or recreational vehicle fire (not on blocks or used as a building)"],
  ["157", "Off-road vehicles or mobile equipment fire"],
  ["185", "Outside stationary compactor or compacted trash fire"],
  ["191", "Munitions or bomb explosion"], ["192", "Blasting agent explosion"], ["193", "Fireworks explosion"],
  ["194", "Incendiary device explosion"], ["195", "Gas explosion"], ["196", "Vapour explosion"], ["197", "Explosion with ensuing fire"],
  ["211", "Overpressure rupture of pipe or pipeline; steam"], ["212", "Overpressure rupture of pipe or pipeline; air or gas"],
  ["221", "Overpressure rupture of boiler; steam"], ["222", "Overpressure rupture of boiler; air or gas"],
  ["231", "Overpressure rupture of pressure vessel; steam"], ["232", "Overpressure rupture of pressure vessel; air or gas"],
  ["301", "Animal Rescue"], ["309", "Other rescue calls"], ["311", "Medical assistance with oxygen therapy"],
  ["312", "Medical assistance with CPR / EAR"], ["313", "Medical assistance"],
  ["321", "EMS call, excluding vehicle accident with injury"], ["323", "EMS call where injured party left scene or transported prior to arrival"],
  ["331", "Lock in"], ["332", "Lock out"], ["341", "Search"], ["342", "Water Search"],
  ["351", "Extrications of victim(s) from mobile property"], ["352", "Vehicle accident - no injuries"],
  ["352.1", "Vehicle accident - with injuries"], ["353", "Removal of victim(s) from stalled elevator / escalator"],
  ["354", "Extrication of victim(s) from mechanical equipment eg industrial, domestic and farm accidents"],
  ["355", "Trench rescue"], ["356", "Confined space rescue"], ["357", "High angle and vertical rescue"],
  ["358", "Extrication of victim(s) from building"], ["361", "Drowning, near drowning"], ["362", "Ice rescue"],
  ["363", "Swift water rescue"], ["364", "Surf rescue"], ["371", "Electrocution"], ["381", "Rescue or EMS standby"],
  ["401", "Suspicious package or unknown substance"], ["412", "Odour or gas leak, (domestic or LPG)"],
  ["413", "Oil or other combustible liquid spill"], ["414", "Minor fuel or other flammable liquid spill/leak – 200 litres or less"],
  ["415", "Major fuel or other flammable liquid spill/leak – 201 or more litres"], ["421", "Explosive, bomb removal (for bomb scare use 628)"],
  ["431", "Excessive heat, overheat, scorch burns with no ignition"], ["432", "Heat from short circuit (wiring), defective or worn insulation"],
  ["433", "Overheated motor"], ["434", "Breakdown of light ballast"], ["435", "Power line down"], ["436", "Arcing, shorted electrical equipment"],
  ["441", "Chemical Hazard (no spill or leak)"], ["442", "Chemical spill or leak (if combustible see 41 series)"],
  ["443", "Radiation leak, radioactive material"], ["444", "Refrigerant leak"], ["445", "Hazardous fibres e.g. asbestos, carbon; no fire"],
  ["446", "Unstable, reactive, explosive material"], ["447", "Carbon monoxide incident"], ["451", "Attempt to burn"],
  ["452", "Threat to burn"], ["453", "Building weakened or collapsed"], ["461", "Aircraft crash, no fire"], ["462", "Aircraft engine malfunction"],
  ["464", "Aircraft hydraulic malfunction"], ["465", "Aircraft wheels or brakes malfunction"], ["466", "Aircraft radio malfunction"],
  ["467", "Aircraft aborted take-off"], ["468", "Bird strike on aircraft"], ["471", "Known biological hazard (e.g. medical waste, blood)"],
  ["501", "Defective elevator no occupants"], ["511", "Water removal"], ["512", "Water or steam leak (includes open hydrants)"],
  ["513", "Smoke or odour removal"], ["514", "Unauthorised burning"], ["521", "Assist police or other governmental agency"],
  ["522", "Police matter"], ["523", "Mutual aid given, coverage assignment, standby at fire station or move up"],
  ["523.2", "Mutual aid given - DELWP"], ["523.3", "Mutual aid given - SES"], ["523.4", "Mutual aid given - Interstate Fire Service"],
  ["523.5", "Mutual aid given - FRV"], ["531", "Earthquake"], ["532", "Flood"], ["533", "Wind storm, including tornado, hurricane or cyclone"],
  ["534", "Lightning strike (no fire)"], ["535", "Severe weather or natural disaster"], ["535.1", "Tree down"],
  ["544", "Telecommunications lines down (including cable TV, telephone and the like)"], ["611", "Wrong location"],
  ["612", "Vicinity alarm (incident in other location) Included are separate locations reported for an actual fire"],
  ["621", "Smoke scare, odour of smoke"], ["622", "Steam vapour, fog or dust thought to be smoke"],
  ["623", "Alarm sounded - no evidence of fire"], ["624", "Controlled burning"], ["625", "Barbecue, hangi"], ["626", "Burglar alarm ringing"],
  ["627", "Suspicious package, harmless substance scare"], ["628", "Bomb scare – no bomb, including parcel resembling bomb"],
  ["711", "Malicious, mischievious false alarm"], ["741", "Sprinkler malfunction – local"], ["742", "Smoke detector malfunction – local"],
  ["743", "Heat detector malfunction- local"], ["744", "Gas detector suspected malfunction – local or non-monitored"],
  ["745", "False alarm generated from private security firm – domestic premises"], ["746", "False alarm generated from private security firm – commercial premises"],
  ["761", "Unintentional alarm - not a malfunction included are turnout pagers"]
];

const GENERAL_PROPERTY = [
  ["00","Complex undetermined"],["11","Public recreation complex. Included are Zoos, Amusements Parks and general Recreation Parks"],
  ["12","Stadium, exhibition complex. Included Football Grounds, Race Tracks and Sports Centres"],["13","Religious use. Included are properties used for Funerals and Cemeteries"],
  ["14","Club complex. Included are Golf Clubs, Tennis Clubs and Country Clubs"],["15","Judicial, legislative, archival, historical use"],
  ["16","Restaurants, food service, drinking establishments"],["18","Theatre complex"],["21","Primary and secondary educational use. Included are facilities through high school levels"],
  ["22","Post secondary level educational use. Included are Colleges and Universities"],["25","Child Day Care"],["31","Care facility - medical treatment is minor"],
  ["33","Medical care. Included are Hospitals, Medical Centres and Mental Institutions"],["34","Prison and detention centres and immigration holding facilities"],
  ["41","Dwellings (one-family and two-family)"],["42","Apartments - included are flats and home units"],["43","Group living use"],
  ["44","Hotel complex. Included are Motels, Inns, Lodges and Backpackers"],["47","Caravan park complex"],["49","Business with residential complex. Included are apartments over stores"],
  ["52","Service use"],["57","Service station complex"],["58","Shopping complex"],["59","Office complex"],["61","Power production complex"],
  ["62","Research use"],["63","Military complex"],["64","Communication use. Included are Data Processing Centres"],["65","Farm complex. Included are grazing, orchards and live stock production"],
  ["66","Aboriginal settlement complex/mission"],["67","Mining, quarrying"],["68","Forestry complex. Included are Tree Farms and Plantations"],
  ["69","Emergency services complex. Included are Police, Ambulance and Fire Stations"],["71","Industrial plant, manufacturing complex"],["81","Warehouse, storage complex"],
  ["91","Refuse/rubbish disposal"],["92","Property undergoing transformation. Included are Construction Sites and Demolition Sites"],
  ["93","Local state and national parks, forests, reserves"],["93.1","Camp-site complex"],["94","Waterfront complex/on water. Included Marina's, Piers and Main Water Ways"],
  ["95","Railroad complex"],["96","Road complex"],["97","Airport complex"],["98","Property without any apparent current use e.g. undeveloped crown land"],
  ["99","Complex not classified"]
];

const FIXED_PROPERTY = [
  ["411","One-family dwelling: year round use"],["412","One-family dwelling: seasonal use"],["414","Two-family dwelling: year round use"],["415","Two-family dwelling: seasonal use"],
  ["416","1 & 2-family living units; specially adapted for occupation by disabled or aged persons"],["421","One or two living units with business. Excluded are 1 or 2 living units without business which are classified as dwellings"],
  ["422","Three to six living units"],["423","Seven to 20 living units"],["424","Over 20 living units"],
  ["441","Less than 20 living units: year-round use"],["442","Less than 20 living units: seasonal use"],["443","20 to 99 living units: year-round use"],["444","20 to 99 living units: seasonal use"],["445","100 or more living units: year-round use"],["446","100 or more living units: seasonal use"],
  ["511","Supermarket"],["512","Market, grocery store"],["513","Specialty food store"],["514","Liquor, beverage store"],["516","Take-away, Delicatessen. Excluded are Drive-In type restaurants (164)"],
  ["531","Furniture stores. Excluded are Office Supply and Desktop office equipment sales (541)"],["532","Appliance store. Excluded are Appliance Repair Shops without sales (538)"],["533","Hardware store"],
  ["541","Book, stationery store. Excluded are sales of larger office equipment and office furniture (531)"],["542","Newsagency, tobacco shop"],["543","Chemist shop"],
  ["551","Hobby, toy shop"],["552","Sporting goods store including firearms and ammunition. Excluded are Sportswear Shops (521)"],["554","Garden supply store"],["556","Pet store, animal hospital"],["558","Fireworks sales"],
  ["571","Service station, public"],["572","Service station, private"],["573","Motor vehicle repair, panel beating paint shop"],["574","Motor vehicle, trailer sales"],["577","Marine service station"],["578","Car wash not forming part of service station"],
  ["591","General business office"],["592","Bank, credit union, building society"],["593","Medical, research, scientific office. Excluded are laboratories classified in Division 62"],["594","Engineering, architectural, technical office"]
];

const ARRIVAL_AGENCIES = ["Ambulance", "CFA", "DELWP", "FRV", "NSW FS", "Police", "SES"];
const CONTROLLER_AGENCIES = ["Ambulance", "CFA", "DELWP", "FRV", "NSW FS", "Police", "SES", "SA FS", "Undetermined"];
const HAZARD_CLASSES = [["2","Medium Urban"],["3","Low Urban"],["4","Rural"]];
const DETECTED_BY = ["Agency/person raising alarm undetermined", "Air Traffic Control, airport management", "Aircraft spotting, observation", "Ambulance", "Automatic Detection System", "Automatic Sprinkler System", "Fire Look-out"];

export function bindFirsFields() {
  ensureShapes();
  fillSelect("firsTypeOfIncident", INCIDENT_TYPES, "Select FIRS incident type");
  fillSelect("firsHazardClass", HAZARD_CLASSES, "Select hazard class");
  fillSelect("firsCallDetectedBy", DETECTED_BY, "Select call detected by", false);
  fillSelect("firsArrivedFirst", ARRIVAL_AGENCIES, "Select first on scene", false);
  fillSelect("firsControllerAgency", CONTROLLER_AGENCIES, "Select controller agency", false);
  fillSelect("firsGeneralPropertyUse", GENERAL_PROPERTY, "Select general property use");
  fillSelect("firsFixedPropertyUse", FIXED_PROPERTY, "Select fixed property use");

  bindGroup("incidentDetails", {
    firsTypeOfIncident: "typeOfIncident", firsNumber: "firsNumber", firsDistrict: "district", firsBrigadeArea: "brigadeArea", firsTerritory: "territory",
    firsHazardClass: "hazardClass", firsCallDetectedBy: "callDetectedBy", firsCallReportedBy: "callReportedBy",
    firsArrivedFirst: "arrivedFirst", firsControllerAgency: "incidentControllerAgency",
    firsCfaController: "cfaIncidentController", firsControllerName: "incidentControllerName", firsControllerId: "incidentControllerId"
  });
  bindGroup("furtherDetails", {
    firsGeneralPropertyUse: "generalPropertyUse", firsFixedPropertyUse: "fixedPropertyUse", firsOccupantType: "typeOfOccupant",
    firsOwnerType: "typeOfOwner", firsOccupantName: "occupantName", firsAmbulanceAttendance: "ambulanceAttendance",
    firsPoliceAttendance: "policeAttendance", firsPoliceName: "policeName", firsPoliceNumber: "policeNumber", firsPoliceStation: "policeStation"
  });
  bindGroup("brigadeResponse", {
    firsResponsePrimaryBrigade: "primaryBrigade", firsBrigadeReportNumber: "brigadeReportNumber", firsActionTaken: "actionTaken",
    firsResponseOic: "officerInCharge", firsMainProblem: "mainProblemEncountered", firsResponseWeather: "weather",
    firsAsbestosExposure: "asbestosExposure", firsHotDebrief: "hotDebrief", firsAarRequired: "aarRequired",
    firsTurnoutFailureCode: "turnoutFailureCode", firsTravelFailureCode: "travelFailureCode", firsSdsComments: "sdsComments"
  });
  bindGroup("incidentSummary", {
    firsSignificantIncident: "significantIncident", firsCadInformation: "cadInformation", firsBrigadeComments: "brigadeComments",
    firsReportCreatedBy: "reportCreatedBy", firsReportCompletedBy: "reportCompletedBy", firsReportCreated: "reportCreated"
  });
  bindGroup("supportReport", {
    firsSupportFirsNumber: "firsNumber", firsSupportDistrict: "district", firsSupportCallToEsta: "callToEsta",
    firsSupportPrimaryBrigade: "primaryBrigade", firsSupportIncidentType: "incidentType", firsSupportBrigade: "supportBrigade",
    firsSupportBrigadeReportNumber: "brigadeReportNumber", firsSupportBrigadePaged: "brigadePaged",
    firsSupportActionTaken: "actionTaken", firsSupportAsbestosExposure: "asbestosExposure",
    firsSupportIncidentComments: "incidentComments"
  });
  document.getElementById("firsSupportAddress")?.addEventListener("input", (event) => {
    state.incident.actualAddress = String(event.target.value || "").trim();
    state.incident.actualAddressEdited = true;
    saveState();
    document.dispatchEvent(new Event("firs:changed"));
  });

  document.getElementById("draftBrigadeCommentsBtn")?.addEventListener("click", () => {
    const current = String(state.firs.incidentSummary.brigadeComments || "").trim();
    if (current && !window.confirm("Replace the current Brigade comments with a new draft from captured facts?")) return;
    state.firs.incidentSummary.brigadeComments = buildBrigadeCommentsDraft();
    saveState(); renderFirsFields(); document.dispatchEvent(new Event("firs:changed"));
  });

  // Preserve useful values already extracted by the original app without silently classifying them.
  if (!state.firs.incidentDetails.arrivedFirst && state.incident.firstAgency) state.firs.incidentDetails.arrivedFirst = state.incident.firstAgency;
  if (!state.firs.brigadeResponse.primaryBrigade && state.incident.primaryBrigade) state.firs.brigadeResponse.primaryBrigade = state.incident.primaryBrigade;
  if (!state.firs.brigadeResponse.officerInCharge && state.responders?.oicName) state.firs.brigadeResponse.officerInCharge = state.responders.oicName;
  if (!state.firs.incidentSummary.reportCreatedBy && state.profile?.name) state.firs.incidentSummary.reportCreatedBy = state.profile.name;
  if (!state.firs.supportReport.supportBrigade && state.profile?.brigade) state.firs.supportReport.supportBrigade = state.profile.brigade;
  if (!state.firs.supportReport.primaryBrigade && state.incident.primaryBrigade) state.firs.supportReport.primaryBrigade = state.incident.primaryBrigade;
  if (!state.firs.supportReport.incidentType && state.incident.incidentType) state.firs.supportReport.incidentType = state.incident.incidentType;
  renderFirsFields();
}

export function renderFirsFields() {
  ensureShapes();
  const d = state.firs.incidentDetails, f = state.firs.furtherDetails;
  setValue("firsTypeOfIncident", d.typeOfIncident); setValue("firsNumber", d.firsNumber); setValue("firsDistrict", d.district); setValue("firsBrigadeArea", d.brigadeArea);
  setValue("firsTerritory", d.territory); setValue("firsHazardClass", d.hazardClass); setValue("firsCallDetectedBy", d.callDetectedBy);
  setValue("firsCallReportedBy", d.callReportedBy); setValue("firsArrivedFirst", d.arrivedFirst); setValue("firsControllerAgency", d.incidentControllerAgency);
  setValue("firsCfaController", d.cfaIncidentController); setValue("firsControllerName", d.incidentControllerName); setValue("firsControllerId", d.incidentControllerId);
  setValue("firsGeneralPropertyUse", f.generalPropertyUse); setValue("firsFixedPropertyUse", f.fixedPropertyUse); setValue("firsOccupantType", f.typeOfOccupant);
  setValue("firsOwnerType", f.typeOfOwner); setValue("firsOccupantName", f.occupantName); setValue("firsAmbulanceAttendance", f.ambulanceAttendance || "Unknown");
  setValue("firsPoliceAttendance", f.policeAttendance || "Unknown"); setValue("firsPoliceName", f.policeName); setValue("firsPoliceNumber", f.policeNumber); setValue("firsPoliceStation", f.policeStation);

  const b = state.firs.brigadeResponse, m = state.firs.incidentSummary;
  setValue("firsResponsePrimaryBrigade", b.primaryBrigade); setValue("firsBrigadeReportNumber", b.brigadeReportNumber); setValue("firsActionTaken", b.actionTaken);
  setValue("firsResponseOic", b.officerInCharge); setValue("firsMainProblem", b.mainProblemEncountered); setValue("firsResponseWeather", b.weather);
  setValue("firsAsbestosExposure", b.asbestosExposure); setValue("firsHotDebrief", b.hotDebrief); setValue("firsAarRequired", b.aarRequired);
  setValue("firsTurnoutFailureCode", b.turnoutFailureCode); setValue("firsTravelFailureCode", b.travelFailureCode); setValue("firsSdsComments", b.sdsComments);
  setValue("firsSignificantIncident", m.significantIncident); setValue("firsCadInformation", m.cadInformation); setValue("firsBrigadeComments", m.brigadeComments);
  setValue("firsReportCreatedBy", m.reportCreatedBy); setValue("firsReportCompletedBy", m.reportCompletedBy); setValue("firsReportCreated", m.reportCreated);

  const sr = state.firs.supportReport || {};
  setValue("firsSupportFirsNumber", sr.firsNumber); setValue("firsSupportDistrict", sr.district); setValue("firsSupportCallToEsta", sr.callToEsta);
  setValue("firsSupportPrimaryBrigade", sr.primaryBrigade); setValue("firsSupportAddress", state.incident.actualAddress); setValue("firsSupportIncidentType", sr.incidentType);
  setValue("firsSupportBrigade", sr.supportBrigade || state.profile?.brigade || ""); setValue("firsSupportBrigadeReportNumber", sr.brigadeReportNumber);
  setValue("firsSupportBrigadePaged", sr.brigadePaged); setValue("firsSupportActionTaken", sr.actionTaken); setValue("firsSupportAsbestosExposure", sr.asbestosExposure);
  setValue("firsSupportIncidentComments", sr.incidentComments);

  const supportMode = state.firs?.pathway === "support";
  document.getElementById("supportCalloutSection")?.classList.toggle("hidden", !supportMode);
  document.getElementById("supportResponseSection")?.classList.toggle("hidden", !supportMode);
  document.getElementById("supportSignoffSection")?.classList.toggle("hidden", !supportMode);
  document.getElementById("supportIncidentCommentsSection")?.classList.toggle("hidden", !supportMode);
  document.getElementById("incidentDetailsSection")?.classList.toggle("hidden", supportMode);
  document.getElementById("operationalDetailsSection")?.classList.toggle("hidden", supportMode);
  document.getElementById("brigadeResponseSection")?.classList.toggle("hidden", supportMode);
  document.getElementById("incidentSummarySection")?.classList.toggle("hidden", supportMode);

  const cfaWrap = document.getElementById("firsCfaControllerWrap");
  const externalWrap = document.getElementById("firsExternalControllerWrap");
  cfaWrap?.classList.toggle("hidden", d.incidentControllerAgency !== "CFA");
  externalWrap?.classList.toggle("hidden", !d.incidentControllerAgency || d.incidentControllerAgency === "CFA");
  document.getElementById("firsPoliceDetailsWrap")?.classList.toggle("hidden", f.policeAttendance !== "Notified and attended");

  const detectedNote = document.getElementById("firsDetectedByNote");
  if (detectedNote) detectedNote.textContent = "Captured FIRS options are incomplete. No uncaptured values have been invented.";
  const propertyNote = document.getElementById("firsFixedPropertyNote");
  if (propertyNote) propertyNote.textContent = "Captured fixed-property list is incomplete. More verified FIRS codes can be added later.";
}

function bindGroup(group, map) {
  Object.entries(map).forEach(([id,key]) => {
    const el=document.getElementById(id); if(!el || el.dataset.firsBound==="1") return;
    el.dataset.firsBound="1";
    const event = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(event, () => {
      state.firs[group][key]=String(el.value||"").trim();
      if (id === "firsTypeOfIncident") {
        state.incident.firsCode = state.firs[group][key].split("|")[0] || "";
      }
      if (id === "firsArrivedFirst") state.incident.firstAgency = state.firs[group][key];
      if (id === "firsResponseOic") state.responders.oicName = state.firs[group][key];
      if (id === "firsResponsePrimaryBrigade") state.incident.primaryBrigade = state.firs[group][key];
      if (id === "firsHotDebrief") state.incident.flags.hotDebrief = state.firs[group][key] === "Yes";
      if (id === "firsAarRequired") state.incident.flags.aarRequired = state.firs[group][key] === "Yes";
      if (id === "firsBrigadeComments") state.incident.comments = state.firs[group][key];
      saveState(); renderFirsFields();
      document.dispatchEvent(new Event("firs:changed"));
    });
  });
}

function fillSelect(id, entries, placeholder, coded=true) {
  const el=document.getElementById(id); if(!el || el.dataset.optionsLoaded==="1") return;
  const opts=[`<option value="">${esc(placeholder)}</option>`];
  entries.forEach(entry => {
    if (Array.isArray(entry)) {
      const [code,label]=entry; const value=coded ? `${code}|${label}` : label;
      opts.push(`<option value="${esc(value)}">${esc(coded ? `${code} - ${label}` : label)}</option>`);
    } else opts.push(`<option value="${esc(entry)}">${esc(entry)}</option>`);
  });
  el.innerHTML=opts.join(""); el.dataset.optionsLoaded="1";
}
function setValue(id,v){ const el=document.getElementById(id); if(el) el.value=v||""; }
function ensureShapes(){
  state.firs ||= {};
  state.firs.incidentDetails ||= {typeOfIncident:"",firsNumber:"",district:"",brigadeArea:"",territory:"",hazardClass:"",callDetectedBy:"",callReportedBy:"",arrivedFirst:"",incidentControllerAgency:"",cfaIncidentController:"",incidentControllerName:"",incidentControllerId:""};
  state.firs.furtherDetails ||= {generalPropertyUse:"",fixedPropertyUse:"",typeOfOccupant:"",typeOfOwner:"",occupantName:"",ambulanceAttendance:"Unknown",policeAttendance:"Unknown",policeName:"",policeNumber:"",policeStation:"",supportingBrigades:[]};
  state.firs.brigadeResponse ||= {primaryBrigade:"",brigadeReportNumber:"",actionTaken:"",officerInCharge:"",mainProblemEncountered:"",weather:"",asbestosExposure:"",hotDebrief:"",aarRequired:"",turnoutFailureCode:"",travelFailureCode:"",sdsComments:""};
  state.firs.incidentSummary ||= {significantIncident:"",cadInformation:"",brigadeComments:"",reportCreatedBy:"",reportCompletedBy:"",reportCreated:""};
  state.firs.supportReport ||= {firsNumber:"",district:"",callToEsta:"",primaryBrigade:"",incidentType:"",supportBrigade:state.profile?.brigade||"Connewarre",brigadeReportNumber:"",brigadePaged:"",actionTaken:"",asbestosExposure:"",incidentComments:""};
}

function buildBrigadeCommentsDraft(){
  const parts=[];
  const type=String(state.firs?.incidentDetails?.typeOfIncident||"");
  const typeLabel=type.includes("|") ? type.split("|").slice(1).join("|") : type;
  if(typeLabel) parts.push(`CFA attended ${typeLabel.toLowerCase()}.`);
  else if(state.incident?.pagerDetails) parts.push(String(state.incident.pagerDetails).trim());

  const address=String(state.incident?.actualAddress||"").trim();
  if(address) parts.push(`Incident at ${address}.`);

  const first=String(state.firs?.incidentDetails?.arrivedFirst||"").trim();
  if(first) parts.push(`${first} recorded as first agency on scene.`);

  const police=state.firs?.furtherDetails?.policeAttendance;
  const ambulance=state.firs?.furtherDetails?.ambulanceAttendance;
  const attended=[];
  if(police==="Notified and attended") attended.push("Police");
  if(ambulance==="Notified and attended") attended.push("Ambulance Victoria");
  if(attended.length) parts.push(`${attended.join(" and ")} attended.`);

  const action=String(state.firs?.brigadeResponse?.actionTaken||"").trim();
  if(action) parts.push(`Brigade action: ${action}.`);
  if(state.incident?.flags?.cancelledEnroute && !action) parts.push("Brigade was cancelled en route.");

  const notes=[];
  if(state.incident?.mva?.notes) notes.push(state.incident.mva.notes);
  if(state.incident?.alarm?.notes) notes.push(state.incident.alarm.notes);
  if(state.incident?.signalNotes) notes.push(state.incident.signalNotes);
  if(notes.length) parts.push(notes.join(" "));
  return parts.join(" ").replace(/\s+/g," ").trim();
}

function esc(v){ return String(v??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
