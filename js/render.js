import {
  state,
  setCurrentPage,
  fillProfileInputs,
  saveProfileFromInputs
} from "./state.js";

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
    fillProfileInputs();
    modal?.classList.remove("hidden");
  });

  closeBtn?.addEventListener("click", () => {
    modal?.classList.add("hidden");
  });

  saveBtn?.addEventListener("click", () => {
    saveProfileFromInputs();
    modal?.classList.add("hidden");
  });
}
