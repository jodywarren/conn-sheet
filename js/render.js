import {
  state,
  fillProfileInputs,
  renderOicBanner,
  saveProfileFromInputs,
  saveState,
  setCurrentPage
} from "./state.js";

export function bindShellEvents() {
  bindTabButtons();
  bindSettingsModal();
  bindOicEditor();
  bindConnectionBanner();
  showPage(state.ui.currentPage || "incidentPage");
}

function bindTabButtons() {
  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pageId = btn.dataset.page;
      showPage(pageId);
      setCurrentPage(pageId);
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
}

function bindSettingsModal() {
  const modal = document.getElementById("settingsModal");
  const openBtn = document.getElementById("openSettingsBtn");
  const closeBtn = document.getElementById("closeSettingsBtn");
  const saveBtn = document.getElementById("saveProfileBtn");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      fillProfileInputs();
      applyProfileCompletionStates();
      modal.classList.remove("hidden");
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  if (saveBtn && modal) {
    saveBtn.addEventListener("click", () => {
      saveProfileFromInputs();
      applyProfileCompletionStates();
      modal.classList.add("hidden");
    });
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }

  [
    "profileName",
    "profileMemberNumber",
    "profileContactNumber",
    "profileEmail",
    "profileBrigade"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", applyProfileCompletionStates);
    el.addEventListener("change", applyProfileCompletionStates);
  });
}

function bindOicEditor() {
  const editBtn = document.getElementById("editOicBtn");
  if (!editBtn) return;

  editBtn.addEventListener("click", () => {
    const currentName = state.responders.oicName || "";
    const currentPhone = state.responders.oicPhone || "";

    const nameInput = window.prompt("OIC name", currentName);
    if (nameInput === null) return;

    const phoneInput = window.prompt("OIC phone number", currentPhone);
    if (phoneInput === null) return;

    state.responders.oicName = String(nameInput || "").trim();
    state.responders.oicPhone = String(phoneInput || "").trim();

    saveState();
    renderOicBanner();
  });
}

function bindConnectionBanner() {
  updateConnectionBanner();

  window.addEventListener("online", updateConnectionBanner);
  window.addEventListener("offline", updateConnectionBanner);
}

function updateConnectionBanner() {
  const banner = document.getElementById("connectionBanner");
  if (!banner) return;

  const online = navigator.onLine;
  banner.textContent = online ? "Online" : "Offline";
  banner.classList.toggle("online", online);
  banner.classList.toggle("offline", !online);
}

function applyProfileCompletionStates() {
  [
    "profileName",
    "profileMemberNumber",
    "profileContactNumber",
    "profileEmail",
    "profileBrigade"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });
}
