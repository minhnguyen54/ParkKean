const STATUS_META = {
  OPEN: { label: "Open", pillClass: "status-pill--open" },
  LIMITED: { label: "Limited", pillClass: "status-pill--limited" },
  FULL: { label: "Full", pillClass: "status-pill--full" },
};

const STATUS_ORDER = ["OPEN", "LIMITED", "FULL"];

const state = {
  lots: [],
  filter: "ALL",
  search: "",
  activePage: "lots",
  currentUser: null,
  leaderboard: [],
  isLive: false,
  isDesktopSidebarCollapsed: false,
  admin: {
    search: "",
    filter: "ALL",
    events: [],
    isSubmittingEvent: false,
    feedbackTimeout: null,
  },
  report: {
    selectedLotId: null,
    selectedStatus: null,
    isSubmitting: false,
  },
};

const dom = {
  lotGrid: document.getElementById("lot-grid"),
  emptyLots: document.querySelector("[data-empty]"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
  countAll: document.querySelector("[data-count-all]"),
  countOpen: document.querySelector("[data-count-open]"),
  countLimited: document.querySelector("[data-count-limited]"),
  countFull: document.querySelector("[data-count-full]"),
  searchInput: document.querySelector("[data-search]"),
  refreshButton: document.querySelector("[data-refresh]"),
  navButtons: Array.from(document.querySelectorAll(".sidebar__nav-button[data-nav]")),
  pageTitle: document.querySelector("[data-page-title]"),
  pageSubtitle: document.querySelector("[data-page-subtitle]"),
  toolbar: document.querySelector("[data-toolbar]"),
  pageSections: Array.from(document.querySelectorAll("[data-page]")),
  leaderboardBody: document.getElementById("leaderboard-body"),
  leaderboardEmpty: document.querySelector("[data-leaderboard-empty]"),
  statPoints: document.querySelector("[data-stat-points]"),
  statEco: document.querySelector("[data-stat-eco]"),
  statStreak: document.querySelector("[data-stat-streak]"),
  username: document.querySelector("[data-username]"),
  usernameInitials: document.querySelector("[data-username-initials]"),
  userEmail: document.querySelector("[data-user-email]"),
  sidebar: document.getElementById("app-sidebar"),
  mobileNavToggle: document.querySelector("[data-nav-toggle]"),
  reportForm: document.querySelector("[data-report-form]"),
  reportLotSelect: document.querySelector("[data-report-lot]"),
  reportStatusContainer: document.querySelector("[data-report-status]"),
  reportNote: document.querySelector("[data-report-note]"),
  reportFeedback: document.querySelector("[data-report-feedback]"),
  reportSubmit: document.querySelector("[data-report-submit]"),
  reportReset: document.querySelector("[data-report-reset]"),
  authOpen: document.querySelector("[data-auth-open]"),
  liveIndicator: document.querySelector("[data-live-indicator]"),
  liveIndicatorText: document.querySelector("[data-live-indicator-text]"),
  adminSearch: document.querySelector("[data-admin-search]"),
  adminFilterButtons: Array.from(document.querySelectorAll("[data-admin-filter]")),
  adminLotList: document.querySelector("[data-admin-lot-list]"),
  adminLotEmpty: document.querySelector("[data-admin-lot-empty]"),
  adminReportFeed: document.querySelector("[data-admin-report-feed]"),
  adminReportEmpty: document.querySelector("[data-admin-report-empty]"),
  adminEventForm: document.querySelector("[data-admin-event-form]"),
  adminEventFeedback: document.querySelector("[data-admin-event-feedback]"),
  adminEventSubmit: document.querySelector("[data-admin-event-submit]"),
};

const mobileMediaQuery = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;

init();

async function init() {
  await ensureUsername();
  setActivePage("lots");
  attachEventListeners();
  setupReportForm();
  setupAdminDashboard();
  setupResponsiveNav();
  await Promise.all([loadLots(), loadLeaderboard(), loadUser()]);
}

function attachEventListeners() {
  dom.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter);
    });
  });

  dom.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.toLowerCase();
    renderLots();
  });

  dom.refreshButton.addEventListener("click", async () => {
    dom.refreshButton.disabled = true;
    try {
      await refreshLots();
    } finally {
      dom.refreshButton.disabled = false;
    }
  });

  dom.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.nav;
      setActivePage(page);
      closeMobileNav();
    });
  });

  if (dom.authOpen) {
    dom.authOpen.addEventListener("click", () => {
      openAuthModal();
    });
  }
}

function setupResponsiveNav() {
  if (!dom.mobileNavToggle || !dom.sidebar) return;

  dom.mobileNavToggle.addEventListener("click", () => {
    toggleMobileNav();
  });

  const handleBreakpointChange = (event) => {
    if (!event.matches) {
      setMobileNavState(false);
      setDesktopSidebarCollapsed(state.isDesktopSidebarCollapsed);
    } else {
      setDesktopSidebarCollapsed(false);
    }
  };

  if (mobileMediaQuery) {
    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", handleBreakpointChange);
    } else if (typeof mobileMediaQuery.addListener === "function") {
      mobileMediaQuery.addListener(handleBreakpointChange);
    }
  } else {
    window.addEventListener("resize", () => {
      if (!isMobileViewport()) {
        setMobileNavState(false);
        setDesktopSidebarCollapsed(state.isDesktopSidebarCollapsed);
      } else {
        setDesktopSidebarCollapsed(false);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.sidebar?.classList.contains("is-open")) {
      closeMobileNav();
    }
  });

  setMobileNavState(false);
  setDesktopSidebarCollapsed(state.isDesktopSidebarCollapsed);
}

function toggleMobileNav() {
  if (isMobileViewport()) {
    const isOpen = dom.sidebar?.classList.contains("is-open");
    setMobileNavState(!isOpen);
  } else {
    toggleDesktopSidebar();
  }
}

function closeMobileNav() {
  if (isMobileViewport()) {
    setMobileNavState(false);
  }
}

function setMobileNavState(shouldOpen) {
  if (!dom.sidebar || !dom.mobileNavToggle) return;
  const enable = Boolean(shouldOpen && isMobileViewport());
  dom.sidebar.classList.toggle("is-open", enable);
  dom.mobileNavToggle.setAttribute("aria-expanded", enable ? "true" : "false");
  document.body.classList.toggle("nav-open", enable);
}

function toggleDesktopSidebar() {
  setDesktopSidebarCollapsed(!state.isDesktopSidebarCollapsed);
}

function setDesktopSidebarCollapsed(collapsed) {
  const value = Boolean(collapsed);
  state.isDesktopSidebarCollapsed = value;
  if (isMobileViewport()) {
    document.body.classList.remove("sidebar-collapsed");
    if (dom.sidebar) {
      dom.sidebar.setAttribute("aria-hidden", "false");
    }
    return;
  }
  document.body.classList.toggle("sidebar-collapsed", value);
  document.body.classList.remove("nav-open");
  if (dom.sidebar) {
    dom.sidebar.setAttribute("aria-hidden", value ? "true" : "false");
  }
  dom.mobileNavToggle?.setAttribute("aria-expanded", value ? "false" : "true");
}

function isMobileViewport() {
  if (mobileMediaQuery) {
    return mobileMediaQuery.matches;
  }
  return window.innerWidth <= 720;
}

function setupReportForm() {
  if (!dom.reportForm || !dom.reportStatusContainer) return;

  dom.reportStatusContainer.innerHTML = "";
  STATUS_ORDER.forEach((status) => {
    const option = document.createElement("label");
    option.className = "status-selector__option";
    option.dataset.statusValue = status;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "report-status";
    input.value = status;
    input.className = "status-selector__input";
    input.addEventListener("change", () => {
      updateReportStatus(status);
      showReportFeedback("");
    });

    option.appendChild(input);
    option.append(STATUS_META[status]?.label ?? status);
    dom.reportStatusContainer.appendChild(option);
  });

  dom.reportForm.addEventListener("submit", handleReportSubmit);
  dom.reportForm.addEventListener("reset", handleReportReset);
  dom.reportLotSelect?.addEventListener("change", handleReportLotChange);

  renderReportForm({ suppressEmptyMessage: true });
}

function setupAdminDashboard() {
  if (!dom.adminLotList) return;

  if (dom.adminSearch) {
    dom.adminSearch.addEventListener("input", (event) => {
      state.admin.search = event.target.value.trim().toLowerCase();
      renderAdminDashboard();
    });
  }

  dom.adminFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAdminFilter(button.dataset.adminFilter);
    });
  });

  if (dom.adminEventForm) {
    dom.adminEventForm.addEventListener("submit", handleAdminEventSubmit);
    dom.adminEventForm.addEventListener("reset", () => {
      setAdminEventFeedback("");
      setAdminEventSubmitting(false);
    });
  }

  if (dom.adminSearch) {
    dom.adminSearch.value = state.admin.search;
  }

  setAdminEventFeedback("");
  setAdminFilter(state.admin.filter);
}

function renderReportForm(options = {}) {
  if (!dom.reportForm || !dom.reportLotSelect) return;
  const { preserveFeedback = false, suppressEmptyMessage = false } = options;
  const lots = state.lots;
  const hasLots = lots.length > 0;

  if (!hasLots) {
    state.report.selectedLotId = null;
    state.report.selectedStatus = null;
  } else if (
    !state.report.selectedLotId ||
    !lots.some((lot) => lot.id === state.report.selectedLotId)
  ) {
    state.report.selectedLotId = lots[0].id;
    state.report.selectedStatus = null;
  }

  dom.reportLotSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = hasLots ? "Select a lot" : "No lots available";
  if (!hasLots) {
    placeholder.selected = true;
    placeholder.defaultSelected = true;
  }
  dom.reportLotSelect.appendChild(placeholder);

  if (hasLots) {
    const selectedLotId = state.report.selectedLotId;
    lots.forEach((lot, index) => {
      const option = document.createElement("option");
      option.value = String(lot.id);
      option.textContent = `${lot.name} (${lot.code})`;
      if (lot.id === selectedLotId || (!selectedLotId && index === 0)) {
        option.selected = true;
        option.defaultSelected = true;
        state.report.selectedLotId = lot.id;
      }
      dom.reportLotSelect.appendChild(option);
    });

    dom.reportLotSelect.value = String(state.report.selectedLotId);
    const lot = getSelectedReportLot();
    const defaultStatus = lot?.status ?? STATUS_ORDER[0];
    if (!state.report.selectedStatus || !STATUS_META[state.report.selectedStatus]) {
      state.report.selectedStatus = defaultStatus;
    }
    updateReportStatus(state.report.selectedStatus);
  } else {
    dom.reportLotSelect.value = "";
    updateReportStatus(null);
  }

  const disable = !hasLots || state.report.isSubmitting;
  setReportFormDisabled(disable);

  if (!hasLots) {
    if (!suppressEmptyMessage && !preserveFeedback) {
      showReportFeedback("No parking lots available to report right now.", true);
    }
  } else if (!state.report.isSubmitting && !preserveFeedback) {
    showReportFeedback("");
  }
}

function handleReportLotChange(event) {
  const value = Number(event.target.value);
  if (!Number.isFinite(value)) {
    state.report.selectedLotId = null;
    state.report.selectedStatus = null;
    updateReportStatus(null);
    return;
  }

  state.report.selectedLotId = value;
  const lot = getSelectedReportLot();
  const nextStatus = lot?.status ?? STATUS_ORDER[0];
  state.report.selectedStatus = nextStatus;
  updateReportStatus(nextStatus);
}

function handleReportReset() {
  const lots = state.lots;
  if (lots.length) {
    state.report.selectedLotId = lots[0].id;
    const lot = getSelectedReportLot();
    const status = lot?.status ?? STATUS_ORDER[0];
    state.report.selectedStatus = status;
    dom.reportLotSelect.value = String(state.report.selectedLotId);
    updateReportStatus(status);
  } else {
    state.report.selectedLotId = null;
    state.report.selectedStatus = null;
    updateReportStatus(null);
  }
  if (dom.reportNote) {
    dom.reportNote.value = "";
  }
  showReportFeedback("");
  setReportFormDisabled(!state.lots.length);
}

async function handleReportSubmit(event) {
  event.preventDefault();
  if (state.report.isSubmitting) return;
  if (!state.currentUser?.username) {
    showReportFeedback("Please choose a username before submitting.", true);
    return;
  }
  const lotIdValue = Number(dom.reportLotSelect?.value);
  if (!Number.isFinite(lotIdValue)) {
    showReportFeedback("Select a parking lot to report.", true);
    return;
  }
  const status = state.report.selectedStatus;
  if (!status || !STATUS_META[status]) {
    showReportFeedback("Pick a status before submitting.", true);
    return;
  }

  const payload = {
    lotId: lotIdValue,
    status,
    note: dom.reportNote?.value?.trim() ?? "",
    username: state.currentUser.username,
  };

  state.report.isSubmitting = true;
  setReportFormDisabled(true);
  showReportFeedback("Submitting report…");

  let feedbackMessage = "";
  let preserveFeedback = false;
  let feedbackIsError = false;
  try {
    const result = await postReport(payload);
    state.currentUser = result.user;
    updateStats();
    updateUserProfile();

    mergeUpdatedLot(result.lot);
    state.report.selectedLotId = result.lot?.id ?? state.report.selectedLotId;
    state.report.selectedStatus = result.lot?.status ?? status;

    renderCounts();
    renderLots();
    renderAdminDashboard();
    await loadLeaderboard();

    const lot = getSelectedReportLot();
    const lotName = lot?.name ?? "the selected lot";
    const meta = STATUS_META[state.report.selectedStatus] ?? STATUS_META.OPEN;
    feedbackMessage = `Thanks! ${lotName} is now marked as ${meta.label}.`;
    preserveFeedback = true;
    if (dom.reportNote) {
      dom.reportNote.value = "";
    }
  } catch (error) {
    console.error(error);
    feedbackMessage = "We couldn't submit that report. Try again?";
    feedbackIsError = true;
    preserveFeedback = true;
    showReportFeedback(feedbackMessage, true);
  } finally {
    state.report.isSubmitting = false;
    renderReportForm({ preserveFeedback });
    if (feedbackMessage && !feedbackIsError) {
      showReportFeedback(feedbackMessage);
    } else if (!feedbackMessage && !state.lots.length) {
      showReportFeedback("No parking lots available to report right now.", true);
    }
  }
}

function updateReportStatus(status) {
  if (!dom.reportStatusContainer) return;
  if (status && STATUS_META[status]) {
    state.report.selectedStatus = status;
  } else {
    state.report.selectedStatus = null;
  }

  const options = dom.reportStatusContainer.querySelectorAll(".status-selector__option");
  options.forEach((option) => {
    const input = option.querySelector(".status-selector__input");
    const matches = Boolean(input && input.value === state.report.selectedStatus);
    if (input) {
      input.checked = matches;
    }
    option.classList.toggle("is-active", matches);
  });
}

function setReportFormDisabled(disabled) {
  if (dom.reportLotSelect) {
    dom.reportLotSelect.disabled = disabled;
  }
  getReportStatusInputs().forEach((input) => {
    input.disabled = disabled;
  });
  if (dom.reportNote) {
    dom.reportNote.disabled = disabled;
  }
  if (dom.reportSubmit) {
    dom.reportSubmit.disabled = disabled;
  }
  if (dom.reportReset) {
    dom.reportReset.disabled = disabled;
  }
}

function getReportStatusInputs() {
  if (!dom.reportStatusContainer) return [];
  return Array.from(
    dom.reportStatusContainer.querySelectorAll('input[name="report-status"]')
  );
}

function showReportFeedback(message = "", isError = false) {
  if (!dom.reportFeedback) return;
  if (!message) {
    dom.reportFeedback.textContent = "";
    dom.reportFeedback.classList.add("is-hidden");
    dom.reportFeedback.classList.remove("form__feedback--error");
    return;
  }

  dom.reportFeedback.textContent = message;
  dom.reportFeedback.classList.toggle("form__feedback--error", Boolean(isError));
  dom.reportFeedback.classList.remove("is-hidden");
}

function getSelectedReportLot() {
  if (!state.report.selectedLotId) return null;
  const targetId = Number(state.report.selectedLotId);
  return state.lots.find((lot) => lot.id === targetId) ?? null;
}

function openAuthModal() {
  const hasUser = Boolean(state.currentUser?.username);
  const modal = createModal(hasUser ? "Switch User" : "Log In");
  const body = modal.querySelector(".modal__body");

  const form = document.createElement("form");
  form.className = "form auth-form";
  form.noValidate = true;

  const group = document.createElement("div");
  group.className = "form__group";

  const label = document.createElement("label");
  label.className = "form__label";
  label.htmlFor = "auth-username";
  label.textContent = "Username";

  const input = document.createElement("input");
  input.id = "auth-username";
  input.name = "username";
  input.className = "input";
  input.placeholder = "Enter a username";
  input.autocomplete = "username";
  input.value = state.currentUser?.username ?? "";

  group.append(label, input);

  const hint = document.createElement("p");
  hint.className = "form__hint";
  hint.textContent = "Switch accounts without losing your points history.";
  group.appendChild(hint);

  const feedbackEl = document.createElement("p");
  feedbackEl.className = "form__feedback is-hidden";

  const actions = document.createElement("div");
  actions.className = "form__actions auth-form__actions";

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn btn--ghost";
  logoutBtn.textContent = hasUser ? "Log out" : "Cancel";

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn--primary";
  submitBtn.textContent = hasUser ? "Switch User" : "Log In";

  actions.append(logoutBtn, submitBtn);
  form.append(group, feedbackEl, actions);
  body.appendChild(form);

  const context = { modal, input, submitBtn, logoutBtn, feedbackEl };
  form.addEventListener("submit", (event) => handleAuthSubmit(event, context));

  if (hasUser) {
    logoutBtn.addEventListener("click", () => handleLogout(context));
  } else {
    logoutBtn.addEventListener("click", () => closeModal(modal));
  }

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function setAuthFeedback(context, message = "", isError = false) {
  const el = context?.feedbackEl;
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.classList.add("is-hidden");
    el.classList.remove("form__feedback--error");
    return;
  }
  el.textContent = message;
  el.classList.toggle("form__feedback--error", Boolean(isError));
  el.classList.remove("is-hidden");
}

async function handleAuthSubmit(event, context) {
  event.preventDefault();
  if (!context) return;
  const { input, submitBtn, logoutBtn } = context;
  const username = input.value?.trim();
  if (!username) {
    setAuthFeedback(context, "Username is required.", true);
    input.focus();
    return;
  }

  setAuthFeedback(context, "Signing you in…");
  submitBtn.disabled = true;
  if (logoutBtn) logoutBtn.disabled = true;

  try {
    await loginUser(username);
    await loadUser();
    await loadLeaderboard();
    renderReportForm();
    closeModal(context.modal);
  } catch (error) {
    console.error(error);
    setAuthFeedback(context, "Couldn't log in. Try again?", true);
  } finally {
    submitBtn.disabled = false;
    if (logoutBtn) logoutBtn.disabled = false;
  }
}

function handleLogout(context) {
  localStorage.removeItem("pk_username");
  state.currentUser = null;
  updateUserProfile();
  updateStats();
  if (state.leaderboard.length) {
    renderLeaderboard();
  }
  renderReportForm();
  showReportFeedback("Log in to submit parking status updates.", true);
  closeModal(context.modal);
}

async function loginUser(rawUsername) {
  const username = rawUsername?.trim();
  if (!username) {
    throw new Error("Username is required");
  }
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) {
    throw new Error("Failed to register user");
  }
  const payload = await response.json();
  state.currentUser = payload.user;
  const stored = payload.user?.username ?? username;
  localStorage.setItem("pk_username", stored);
  updateUserProfile();
  updateStats();
  if (state.leaderboard.length) {
    renderLeaderboard();
  }
}

async function ensureUsername() {
  let username = localStorage.getItem("pk_username");
  if (!username) {
    const input = prompt("Pick a username for the leaderboard:")?.trim();
    if (input) {
      username = input;
    } else {
      username = `guest${Math.floor(Math.random() * 1000)}`;
    }
  }
  await loginUser(username);
}

function updateUserProfile() {
  const username = state.currentUser?.username ?? "Guest";
  dom.username.textContent = username;
  dom.userEmail.textContent = state.currentUser
    ? `${state.currentUser.username}@parkkean.edu`
    : "guest@parkkean.edu";
  dom.usernameInitials.textContent = initialsFor(username);
  if (dom.authOpen) {
    dom.authOpen.textContent = state.currentUser ? "Switch / Log out" : "Log in";
  }
}

function updateStats() {
  const points = state.currentUser?.points ?? 0;
  const reports = state.currentUser?.reports ?? 0;
  dom.statPoints.textContent = points;
  dom.statEco.textContent = Math.floor(points / 2);
  dom.statStreak.textContent = `${reports} day${reports === 1 ? "" : "s"}`;
}

function updateLiveIndicator() {
  if (!dom.liveIndicator || !dom.liveIndicatorText) return;
  dom.liveIndicator.classList.remove("is-live", "is-stale");

  if (!state.lots.length) {
    dom.liveIndicatorText.textContent = "Offline data";
    return;
  }

  const latestTimestamp = state.lots.reduce((latest, lot) => {
    const value = Number(lot.last_updated);
    if (!Number.isFinite(value)) return latest;
    return value > latest ? value : latest;
  }, 0);

  const recencyLabel = latestTimestamp ? formatRelativeAge(latestTimestamp) : "";

  if (!state.isLive) {
    dom.liveIndicatorText.textContent = recencyLabel
      ? `Offline data · ${recencyLabel}`
      : "Offline data";
    return;
  }

  const age = Date.now() - latestTimestamp;
  const staleThreshold = 5 * 60 * 1000;

  if (age > staleThreshold) {
    dom.liveIndicator.classList.add("is-stale");
    dom.liveIndicatorText.textContent = recencyLabel
      ? `Live feed stale · ${recencyLabel}`
      : "Live feed stale";
  } else {
    dom.liveIndicator.classList.add("is-live");
    dom.liveIndicatorText.textContent = recencyLabel
      ? `Live feed · ${recencyLabel}`
      : "Live feed";
  }
}

async function loadLots() {
  const response = await fetch("/api/lots");
  if (!response.ok) {
    console.error("Failed to load lots");
    return;
  }
  const payload = await response.json();
  state.lots = payload.lots;
  state.isLive = Boolean(payload.live);
  renderCounts();
  renderLots();
  renderReportForm();
  renderAdminDashboard();
}

async function loadLeaderboard() {
  const response = await fetch("/api/leaderboard");
  if (!response.ok) {
    console.error("Failed to load leaderboard");
    return;
  }
  const payload = await response.json();
  state.leaderboard = payload.leaderboard;
  renderLeaderboard();
}

async function loadUser() {
  const username = state.currentUser?.username;
  if (!username) return;
  const response = await fetch(`/api/users/${encodeURIComponent(username)}`);
  if (!response.ok) {
    console.error("Failed to load user stats");
    return;
  }
  const payload = await response.json();
  state.currentUser = payload.user;
  updateStats();
  updateUserProfile();
  renderLeaderboard();
}

function renderLots() {
  const filtered = state.lots.filter((lot) => {
    const matchesFilter = state.filter === "ALL" || lot.status === state.filter;
    const matchesSearch =
      !state.search ||
      lot.name.toLowerCase().includes(state.search) ||
      lot.code.toLowerCase().includes(state.search);
    return matchesFilter && matchesSearch;
  });

  dom.lotGrid.innerHTML = "";

  if (filtered.length === 0) {
    dom.emptyLots.classList.remove("is-hidden");
    updateLiveIndicator();
    return;
  }

  dom.emptyLots.classList.add("is-hidden");
  const template = document.getElementById("lot-card-template");

  filtered.forEach((lot) => {
    const node = template.content.firstElementChild.cloneNode(true);
    populateLotCard(node, lot);
    dom.lotGrid.appendChild(node);
  });

  updateLiveIndicator();
}

function setAdminFilter(rawFilter) {
  const upper = String(rawFilter || "ALL").toUpperCase();
  const next = upper === "ALL" || STATUS_META[upper] ? upper : "ALL";
  state.admin.filter = next;
  dom.adminFilterButtons.forEach((button) => {
    const isActive = button.dataset.adminFilter === next;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderAdminDashboard();
}

function renderAdminDashboard() {
  if (!dom.adminLotList && !dom.adminReportFeed) return;
  renderAdminLots();
  renderAdminReports();
}

function getAdminFilteredLots() {
  const search = state.admin.search;
  const filter = state.admin.filter;
  return state.lots.filter((lot) => {
    const matchesFilter = filter === "ALL" || lot.status === filter;
    if (!matchesFilter) return false;
    if (!search) return true;
    const lotName = String(lot.name || "").toLowerCase();
    const lotCode = String(lot.code || "").toLowerCase();
    return lotName.includes(search) || lotCode.includes(search);
  });
}

function renderAdminLots() {
  if (!dom.adminLotList) return;
  const filteredLots = getAdminFilteredLots();
  dom.adminLotList.innerHTML = "";

  if (!filteredLots.length) {
    dom.adminLotEmpty?.classList.remove("is-hidden");
    return;
  }

  dom.adminLotEmpty?.classList.add("is-hidden");

  filteredLots.forEach((lot) => {
    const item = document.createElement("li");
    item.className = "admin-lot";

    const header = document.createElement("div");
    header.className = "admin-lot__top";

    const name = document.createElement("span");
    name.className = "admin-lot__name";
    name.textContent = lot.name;
    header.appendChild(name);

    header.appendChild(createStatusPill(lot.status, { compact: true }));
    item.appendChild(header);

    const occupancy = document.createElement("p");
    occupancy.className = "admin-lot__meta";
    const lotCode = lot.code || "—";
    const occupancyCount = Number.isFinite(Number(lot.occupancy)) ? Number(lot.occupancy) : 0;
    const capacityCount = Number.isFinite(Number(lot.capacity)) ? Number(lot.capacity) : 0;
    occupancy.textContent = `${lotCode} · ${occupancyCount}/${capacityCount} occupied`;
    item.appendChild(occupancy);

    const updated = document.createElement("p");
    updated.className = "admin-lot__meta";
    const recency = formatRelativeAge(lot.last_updated);
    updated.textContent = recency ? `Last update ${recency}` : "Last update —";
    item.appendChild(updated);

    dom.adminLotList.appendChild(item);
  });
}

function renderAdminReports() {
  if (!dom.adminReportFeed) return;
  dom.adminReportFeed.innerHTML = "";

  const reports = state.lots
    .map((lot) => (lot.lastReport ? { lot, report: lot.lastReport } : null))
    .filter(Boolean)
    .sort((a, b) => (Number(b.report.created_at) || 0) - (Number(a.report.created_at) || 0))
    .slice(0, 5);

  if (!reports.length) {
    dom.adminReportEmpty?.classList.remove("is-hidden");
    return;
  }

  dom.adminReportEmpty?.classList.add("is-hidden");

  reports.forEach(({ lot, report }) => {
    const item = document.createElement("li");
    item.className = "admin-report";

    const header = document.createElement("div");
    header.className = "admin-report__header";

    const lotName = document.createElement("span");
    lotName.className = "admin-report__lot";
    lotName.textContent = lot.name;
    header.appendChild(lotName);

    header.appendChild(createStatusPill(report.reported_status, { compact: true }));
    item.appendChild(header);

    const meta = document.createElement("p");
    meta.className = "admin-report__meta";
    const recency = formatRelativeAge(report.created_at);
    const timestamp = recency || formatDateTime(report.created_at);
    const reporter = report.user || "Anonymous";
    meta.textContent = `Reported by ${reporter} · ${timestamp}`;
    item.appendChild(meta);

    if (report.note) {
      const note = document.createElement("p");
      note.className = "admin-report__note";
      note.textContent = report.note;
      item.appendChild(note);
    }

    dom.adminReportFeed.appendChild(item);
  });
}

function createStatusPill(status, options = {}) {
  const { compact = false } = options;
  const meta = STATUS_META[status] || STATUS_META.OPEN;
  const pill = document.createElement("span");
  pill.className = "status-pill";
  if (compact) {
    pill.classList.add("status-pill--compact");
  }
  pill.classList.add(meta.pillClass);
  pill.textContent = meta.label;
  return pill;
}

function setAdminEventSubmitting(submitting) {
  state.admin.isSubmittingEvent = Boolean(submitting);
  if (dom.adminEventSubmit) {
    dom.adminEventSubmit.disabled = submitting;
  }
}

function handleAdminEventSubmit(event) {
  event.preventDefault();
  if (state.admin.isSubmittingEvent) return;
  const form = event.target;
  const nameInput = form.elements.eventName;
  const dateInput = form.elements.eventDate;
  const name = nameInput?.value?.trim();
  const dateValue = dateInput?.value;

  if (!name) {
    setAdminEventFeedback("Enter an event name to continue.", { isError: true, persist: true });
    nameInput?.focus();
    return;
  }

  if (!dateValue) {
    setAdminEventFeedback("Choose a date for the event.", { isError: true, persist: true });
    dateInput?.focus();
    return;
  }

  setAdminEventSubmitting(true);
  try {
    const eventDate = new Date(dateValue);
    if (Number.isNaN(eventDate.getTime())) {
      setAdminEventFeedback("Choose a valid date for the event.", {
        isError: true,
        persist: true,
      });
      dateInput?.focus();
      return;
    }

    state.admin.events.unshift({
      id: Date.now(),
      name,
      date: eventDate.toISOString(),
    });

    form.reset();
    setAdminEventFeedback(
      `Reserved support for "${name}" on ${formatAdminEventDate(eventDate)}.`,
      { isError: false }
    );
  } finally {
    setAdminEventSubmitting(false);
  }
}

function setAdminEventFeedback(message, options = {}) {
  if (!dom.adminEventFeedback) return;
  const { isError = false, persist = false } = options;
  if (state.admin.feedbackTimeout) {
    clearTimeout(state.admin.feedbackTimeout);
    state.admin.feedbackTimeout = null;
  }

  if (!message) {
    dom.adminEventFeedback.textContent = "";
    dom.adminEventFeedback.classList.add("is-hidden");
    dom.adminEventFeedback.classList.remove("admin-card__hint--error");
    return;
  }

  dom.adminEventFeedback.textContent = message;
  dom.adminEventFeedback.classList.remove("is-hidden");
  dom.adminEventFeedback.classList.toggle("admin-card__hint--error", Boolean(isError));

  if (!persist) {
    state.admin.feedbackTimeout = setTimeout(() => {
      setAdminEventFeedback("");
    }, 4000);
  }
}

function formatAdminEventDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "selected date";
  }
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function populateLotCard(node, lot) {
  const meta = STATUS_META[lot.status] || STATUS_META.OPEN;
  const occupancy = Number(lot.occupancy ?? 0);
  const capacity = Number(lot.capacity ?? 0);
  const occupancyPct = capacity ? Math.round((occupancy / capacity) * 100) : 0;

  node.dataset.lotId = lot.id;
  node.querySelector(".lot-card__title").textContent = lot.name;
  node.querySelector(".lot-card__code").textContent = `Code: ${lot.code}`;
  const pill = node.querySelector(".status-pill");
  pill.textContent = meta.label;
  pill.classList.add(meta.pillClass);

  node.querySelector(".lot-card__metric-count").textContent = `${occupancy}/${capacity}`;
  node.querySelector(".lot-card__metric-percent").textContent = `${occupancyPct}%`;
  const progress = node.querySelector(".lot-card__progress-fill");
  progress.style.width = `${Math.min(100, Math.max(0, occupancyPct))}%`;
  progress.classList.add(meta.pillClass);

  node.querySelector(".lot-card__meta-walk").textContent = `${lot.walk_time ?? "—"} min walk`;
  node.querySelector(".lot-card__meta-full").textContent = `Full by ${lot.full_by ?? "—"}`;
  node.querySelector(".lot-card__updated").textContent = formatUpdated(lot.last_updated);

  const latestReport = node.querySelector(".lot-card__report");
  if (lot.lastReport) {
    latestReport.classList.remove("is-hidden");
    latestReport.textContent = `Latest update by ${lot.lastReport.user} · ${formatDateTime(
      lot.lastReport.created_at
    )}`;
  } else {
    latestReport.classList.add("is-hidden");
  }

  node.querySelector('[data-action="details"]').addEventListener("click", () => {
    openDetailsModal(lot.id);
  });
  node.querySelector('[data-action="report"]').addEventListener("click", () => {
    openReportModal(lot.id);
  });
}

function renderCounts() {
  const totals = { ALL: state.lots.length, OPEN: 0, LIMITED: 0, FULL: 0 };
  state.lots.forEach((lot) => {
    totals[lot.status] = (totals[lot.status] || 0) + 1;
  });

  dom.countAll.textContent = totals.ALL ?? 0;
  dom.countOpen.textContent = totals.OPEN ?? 0;
  dom.countLimited.textContent = totals.LIMITED ?? 0;
  dom.countFull.textContent = totals.FULL ?? 0;
}

function mergeUpdatedLot(updatedLot) {
  if (!updatedLot || typeof updatedLot.id === "undefined") return;
  const index = state.lots.findIndex((lot) => lot.id === updatedLot.id);
  if (index >= 0) {
    state.lots.splice(index, 1, updatedLot);
  } else {
    state.lots.push(updatedLot);
  }
}

function renderLeaderboard() {
  dom.leaderboardBody.innerHTML = "";
  if (!state.leaderboard.length) {
    dom.leaderboardEmpty.classList.remove("is-hidden");
    return;
  }

  dom.leaderboardEmpty.classList.add("is-hidden");
  state.leaderboard.forEach((user, index) => {
    const row = document.createElement("tr");
    row.className = "leaderboard__row";
    if (state.currentUser && user.username === state.currentUser.username) {
      row.classList.add("is-active");
    }

    const rankCell = document.createElement("td");
    rankCell.className = "leaderboard__cell leaderboard__cell--rank";
    rankCell.appendChild(createRankBadge(index + 1));

    const userCell = document.createElement("td");
    userCell.className = "leaderboard__cell leaderboard__cell--user";
    userCell.textContent = user.username;

    const pointsCell = document.createElement("td");
    pointsCell.className = "leaderboard__cell leaderboard__cell--right";
    pointsCell.textContent = user.points;

    row.append(rankCell, userCell, pointsCell);
    dom.leaderboardBody.appendChild(row);
  });
}

function setFilter(filter) {
  state.filter = filter;
  dom.filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderLots();
}

function setActivePage(page) {
  state.activePage = page;
  dom.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === page);
  });

  dom.pageSections.forEach((section) => {
    const isActive = section.dataset.page === page;
    section.classList.toggle("is-hidden", !isActive);
  });

  const isLots = page === "lots";
  dom.toolbar.classList.toggle("is-hidden", !isLots);
  dom.refreshButton.classList.toggle("is-hidden", !isLots);

  if (isLots) {
    dom.pageTitle.textContent = "Campus Parking";
    dom.pageSubtitle.textContent = "Find available parking spaces in real-time";
  } else if (page === "admin") {
    dom.pageTitle.textContent = "Admin Dashboard";
    dom.pageSubtitle.textContent = "Oversee lots, reports, and campus events";
  } else if (page === "leaderboard") {
    dom.pageTitle.textContent = "Community Leaderboard";
    dom.pageSubtitle.textContent = "See who's leading the charge in keeping ParkKean updated";
  } else if (page === "report") {
    dom.pageTitle.textContent = "Report a Parking Status";
    dom.pageSubtitle.textContent = "Share live updates to help classmates find the best spots";
  } else {
    dom.pageTitle.textContent = "ParkKean";
    dom.pageSubtitle.textContent = "Your campus parking assistant";
  }
}

async function refreshLots() {
  const response = await fetch("/api/lots/refresh", { method: "POST" });
  if (!response.ok) {
    console.error("Failed to refresh lots");
    return;
  }
  const payload = await response.json();
  state.lots = payload.lots;
  state.isLive = Boolean(payload.live);
  renderCounts();
  renderLots();
  renderReportForm();
  renderAdminDashboard();
}

async function openDetailsModal(lotId) {
  const lot = state.lots.find((item) => item.id === lotId);
  if (!lot) return;

  const response = await fetch(`/api/lots/${lotId}/reports`);
  const payload = response.ok ? await response.json() : { reports: [] };
  const reports = payload.reports ?? [];
  if (reports.length) {
    lot.lastReport = reports[0];
  }

  const modal = createModal(`${lot.name} Details`);
  const body = modal.querySelector(".modal__body");

  const section = document.createElement("div");
  section.className = "modal-section";

  const highlight = document.createElement("div");
  highlight.className = "modal-highlight";

  highlight.appendChild(createHighlightBlock("Code", lot.code));
  highlight.appendChild(createHighlightBlock("Capacity", lot.capacity));

  const statusPill = document.createElement("span");
  statusPill.className = "status-pill status-pill--compact";
  const meta = STATUS_META[lot.status] || STATUS_META.OPEN;
  statusPill.classList.add(meta.pillClass);
  statusPill.textContent = meta.label;
  highlight.appendChild(statusPill);

  section.appendChild(highlight);

  const updated = document.createElement("p");
  updated.className = "modal-updated";
  updated.textContent = formatUpdated(lot.last_updated);
  section.appendChild(updated);

  const listWrapper = document.createElement("div");
  listWrapper.className = "modal-list";

  const listTitle = document.createElement("h4");
  listTitle.className = "modal-list__title";
  listTitle.textContent = "Recent Reports";
  listWrapper.appendChild(listTitle);

  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "empty-inline";
    empty.textContent = "No reports yet.";
    listWrapper.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "modal-list__items";

    reports.forEach((report) => {
      const item = document.createElement("li");
      item.className = "report-card";

      const header = document.createElement("div");
      header.className = "report-card__header";
      const user = document.createElement("span");
      user.className = "report-card__user";
      user.textContent = report.user;
      header.appendChild(user);

      const pill = document.createElement("span");
      pill.className = "status-pill status-pill--compact";
      const metaReport = STATUS_META[report.reported_status] || STATUS_META.OPEN;
      pill.classList.add(metaReport.pillClass);
      pill.textContent = metaReport.label;
      header.appendChild(pill);
      item.appendChild(header);

      if (report.note) {
        const note = document.createElement("p");
        note.className = "report-card__note";
        note.textContent = report.note;
        item.appendChild(note);
      }

      const timestamp = document.createElement("p");
      timestamp.className = "report-card__timestamp";
      timestamp.textContent = formatDateTime(report.created_at);
      item.appendChild(timestamp);

      list.appendChild(item);
    });

    listWrapper.appendChild(list);
  }

  section.appendChild(listWrapper);
  body.appendChild(section);
}

function createHighlightBlock(label, value) {
  const wrapper = document.createElement("div");
  const labelEl = document.createElement("p");
  labelEl.className = "modal-highlight__label";
  labelEl.textContent = label;
  const valueEl = document.createElement("p");
  valueEl.className = "modal-highlight__value";
  valueEl.textContent = value;
  wrapper.append(labelEl, valueEl);
  return wrapper;
}

async function openReportModal(lotId) {
  const lot = state.lots.find((item) => item.id === lotId);
  if (!lot) return;

  const modal = createModal(`Report Status — ${lot.name}`);
  const body = modal.querySelector(".modal__body");

  const form = document.createElement("form");
  form.className = "form";
  form.noValidate = true;

  const statusGroup = document.createElement("div");
  statusGroup.className = "form__group";
  const statusLabel = document.createElement("label");
  statusLabel.className = "form__label";
  statusLabel.textContent = "Status";
  statusGroup.appendChild(statusLabel);

  const statusSelector = document.createElement("div");
  statusSelector.className = "status-selector";
  statusGroup.appendChild(statusSelector);

  STATUS_ORDER.forEach((statusValue) => {
    const option = document.createElement("label");
    option.className = "status-selector__option";
    if (statusValue === lot.status) {
      option.classList.add("is-active");
    }

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "status";
    input.value = statusValue;
    input.checked = statusValue === lot.status;
    input.className = "status-selector__input";
    input.addEventListener("change", () => {
      statusSelector.querySelectorAll(".status-selector__option").forEach((el) => {
        el.classList.toggle("is-active", el.contains(input) && input.checked);
      });
    });

    option.appendChild(input);
    option.append(STATUS_META[statusValue].label);
    statusSelector.appendChild(option);
  });

  const noteGroup = document.createElement("div");
  noteGroup.className = "form__group";
  const noteLabel = document.createElement("label");
  noteLabel.htmlFor = "report-note";
  noteLabel.className = "form__label";
  noteLabel.textContent = "Optional note";
  noteGroup.appendChild(noteLabel);
  const textarea = document.createElement("textarea");
  textarea.id = "report-note";
  textarea.className = "input textarea";
  textarea.placeholder = "e.g., Upper deck closed for maintenance.";
  noteGroup.appendChild(textarea);

  const actions = document.createElement("div");
  actions.className = "form__actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn--ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => closeModal(modal));
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn--primary";
  submit.textContent = "Submit (+5 pts)";
  actions.append(cancel, submit);

  form.append(statusGroup, noteGroup, actions);
  body.appendChild(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const statusInput = form.querySelector('input[name="status"]:checked');
    if (!statusInput) return;
    const payload = {
      lotId,
      status: statusInput.value,
      note: textarea.value,
      username: state.currentUser?.username,
    };
    submit.disabled = true;
    try {
      const result = await postReport(payload);
      state.currentUser = result.user;
      updateStats();
      await Promise.all([loadLots(), loadLeaderboard()]);
      closeModal(modal);
    } catch (error) {
      console.error(error);
      submit.disabled = false;
    }
  });
}

function createModal(title) {
  const template = document.getElementById("modal-template");
  const fragment = template.content.firstElementChild.cloneNode(true);
  const modal = fragment.querySelector(".modal");
  modal.querySelector(".modal__title").textContent = title;
  fragment.addEventListener("click", (event) => {
    if (event.target.matches("[data-close]")) {
      closeModal(fragment);
    }
  });
  document.body.appendChild(fragment);
  return fragment;
}

function closeModal(modal) {
  modal?.remove();
}

async function postReport(payload) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to submit report");
  }
  return response.json();
}

function createRankBadge(rank) {
  const span = document.createElement("span");
  span.className = "rank-badge";
  if (rank === 1) {
    span.classList.add("rank-badge--gold");
    span.textContent = "🥇 1";
  } else if (rank === 2) {
    span.classList.add("rank-badge--silver");
    span.textContent = "🥈 2";
  } else if (rank === 3) {
    span.classList.add("rank-badge--bronze");
    span.textContent = "🥉 3";
  } else {
    span.classList.add("rank-badge--default");
    span.textContent = rank;
  }
  return span;
}

function formatRelativeAge(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return "";
  const delta = Date.now() - value;
  if (delta < 0) return "just now";
  const minutes = Math.floor(delta / 60000);
  if (minutes <= 0) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatUpdated(timestamp) {
  if (!timestamp) return "Updated —";
  const date = new Date(Number(timestamp));
  return `Updated ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function formatDateTime(timestamp) {
  const date = new Date(Number(timestamp));
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialsFor(name) {
  if (!name) return "P";
  const parts = name.split(/[\s_\-]+/).filter(Boolean);
  const first = parts[0]?.[0]?.toUpperCase() ?? "";
  const second = parts[1]?.[0]?.toUpperCase() ?? "";
  return (first + second || first || "P").slice(0, 2);
}
