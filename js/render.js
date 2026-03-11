import { state, setCurrentPage, saveState } from "./state.js";

export function bindShellEvents() {
  bindTabs();
  bindSettings();
  showPage(state.ui?.currentPage || "incidentPage");
}

function bindTabs() {
  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showPage(btn.dataset.page);
    });
  });
}

function showPage(pageId) {
  setCurrentPage(pageId);

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
}

function bindSettings() {
  const openBtn = document.getElementById("openSettingsBtn");
  const closeBtn = document.getElementById("closeSettingsBtn");
  const saveBtn = document.getElementById("saveProfileBtn");
  const modal = document.getElementById("settingsModal");

  openBtn?.addEventListener("click", () => {
    loadProfileInputsFromState();
    modal?.classList.remove("hidden");
  });

  closeBtn?.addEventListener("click", () => {
    modal?.classList.add("hidden");
  });

  saveBtn?.addEventListener("click", () => {
    saveProfileInputsToState();
    saveState();
    modal?.classList.add("hidden");
  });
}

function loadProfileInputsFromState() {
  const nameEl = document.getElementById("profileName");
  const memberEl = document.getElementById("profileMemberNumber");
  const contactEl = document.getElementById("profileContactNumber");
  const emailEl = document.getElementById("profileEmail");
  const brigadeEl = document.getElementById("profileBrigade");

  if (nameEl) nameEl.value = state.profile?.name || "";
  if (memberEl) memberEl.value = state.profile?.memberNumber || "";
  if (contactEl) contactEl.value = state.profile?.contactNumber || "";
  if (emailEl) emailEl.value = state.profile?.email || "";
  if (brigadeEl) brigadeEl.value = state.profile?.brigade || "Connewarre";
}

function saveProfileInputsToState() {
  const nameEl = document.getElementById("profileName");
  const memberEl = document.getElementById("profileMemberNumber");
  const contactEl = document.getElementById("profileContactNumber");
  const emailEl = document.getElementById("profileEmail");
  const brigadeEl = document.getElementById("profileBrigade");

  state.profile.name = nameEl?.value.trim() || "";
  state.profile.memberNumber = memberEl?.value.trim() || "";
  state.profile.contactNumber = contactEl?.value.trim() || "";
  state.profile.email = emailEl?.value.trim() || "";
  state.profile.brigade = brigadeEl?.value.trim() || "Connewarre";
}
