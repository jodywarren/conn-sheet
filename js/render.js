import {
  state,
  fillProfileInputs,
  renderOicBanner,
  saveProfileFromInputs,
  setCurrentPage,
  saveState,
  applyTheme
} from "./state.js";

export function bindShellEvents() {
  bindTabButtons();
  bindSettingsModal();
  bindOicPicker();
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
      applyTheme();
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

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      state.ui.theme = themeToggle.checked ? "dark" : "light";
      applyTheme();
      saveState();
    });
  }
}

function bindOicPicker() {
  const modal = document.getElementById("oicModal");
  const openBtn = document.getElementById("editOicBtn");
  const closeBtn = document.getElementById("closeOicBtn");
  const saveBtn = document.getElementById("saveOicBtn");
  const nameInput = document.getElementById("oicSearchInput");
  const phoneInput = document.getElementById("oicPhoneInput");
  const list = document.getElementById("oicMembersList");

  if (!modal || !openBtn || !closeBtn || !saveBtn || !nameInput || !phoneInput || !list) return;

  openBtn.addEventListener("click", () => {
    rebuildOicList();
    nameInput.value = state.responders.oicName || "";
    phoneInput.value = state.responders.oicPhone || "";
    modal.classList.remove("hidden");
    setTimeout(() => nameInput.focus(), 50);
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });

  nameInput.addEventListener("input", () => {
    const member = findMemberByName(nameInput.value);
    if (member) {
      phoneInput.value = member.phone || "";
    }
  });

  saveBtn.addEventListener("click", () => {
    const member = findMemberByName(nameInput.value);

    state.responders.oicName = member?.name || nameInput.value.trim();
    state.responders.oicPhone = member?.phone || phoneInput.value.trim();

    renderOicBanner();
    saveState();
    modal.classList.add("hidden");
  });

  function rebuildOicList() {
    const members = getAllMembers();
    list.innerHTML = members
      .map((m) => `<option value="${escapeHtml(m.name)}"></option>`)
      .join("");
  }
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
