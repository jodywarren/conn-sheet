
import {
  state,
  setCurrentPage,
  openSettings,
  closeSettings,
  saveProfileFromInputs,
  fillProfileInputs
} from "./state.js";

export function bindShellEvents() {
  bindTabEvents();
  bindSettingsEvents();
  renderShell();
}

function bindTabEvents() {
  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCurrentPage(btn.dataset.page);
      renderShell();
    });
  });
}

function bindSettingsEvents() {
  const openBtn = document.getElementById("openSettingsBtn");
  const closeBtn = document.getElementById("closeSettingsBtn");
  const saveBtn = document.getElementById("saveProfileBtn");

  openBtn?.addEventListener("click", () => {
    openSettings();
    fillProfileInputs();
    renderShell();
  });

  closeBtn?.addEventListener("click", () => {
    closeSettings();
    renderShell();
  });

  saveBtn?.addEventListener("click", () => {
    saveProfileFromInputs();
    closeSettings();
    renderShell();
  });
}

export function renderShell() {
  renderPages();
  renderTabs();
  renderSettingsModal();
}

function renderPages() {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === state.ui.currentPage);
  });
}

function renderTabs() {
  document.querySelectorAll(".tab-btn[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === state.ui.currentPage);
  });
}

function renderSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  modal.classList.toggle("hidden", !state.ui.settingsOpen);
}
