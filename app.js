(function () {
  "use strict";

  const THEME_KEY = "eb5-theme";
  const FORM_STATE_KEY = "eb5-form-state";
  const SAVE_DEBOUNCE_MS = 500;
  const PROGRESS_MAX_FIELDS = 15;

  const DATE_FIELD_IDS = [
    "priority-date",
    "i956f-approval",
    "biometric-notice",
    "ead-approval",
    "ap-approval",
    "i526-date",
    "wom-date",
    "wom-resolution-date",
    "i485-date",
  ];

  const DATE_FIELD_META = [
    { id: "priority-date" },
    { id: "i956f-approval" },
    { id: "biometric-notice", pendingId: "biometric-notice-pending" },
    { id: "ead-approval", pendingId: "ead-approval-pending" },
    { id: "ap-approval", pendingId: "ap-approval-pending" },
    { id: "i526-date", pendingId: "i526-date-pending" },
    { id: "wom-date", notFiledId: "wom-date-not-filed" },
    { id: "wom-resolution-date" },
    { id: "i485-date", pendingId: "i485-date-pending" },
  ];

  const I526_ADVERSE_STATUSES = new Set(["RFE", "NOID", "Denied"]);

  const form = document.getElementById("status-form");
  const preview = document.getElementById("preview");
  const mobilePreview = document.getElementById("mobile-preview");
  const copyBtn = document.getElementById("copy-btn");
  const mobileCopyBtn = document.getElementById("mobile-copy-btn");
  const refreshBtn = document.getElementById("refresh-preview");
  const previewPanel = document.getElementById("preview-panel");
  const celebrationToast = document.getElementById("celebration-toast");
  const celebrationToastText = document.getElementById("celebration-toast-text");
  const restoreToast = document.getElementById("restore-toast");
  const clearFormBtn = document.getElementById("clear-form-btn");
  const statKeyUpdate = document.getElementById("stat-key-update");
  const statDaysPd = document.getElementById("stat-days-pd");
  const statFieldsFilled = document.getElementById("stat-fields-filled");
  const progressFill = document.getElementById("progress-fill");
  const fabFieldCount = document.getElementById("fab-field-count");
  const previewFab = document.getElementById("preview-fab");
  const previewSheet = document.getElementById("preview-sheet");
  const comboCardToggle = document.getElementById("combo-card");
  const themeToggle = document.getElementById("theme-toggle");

  const SOF_DETAIL_FIELDS = [
    { checkboxId: "sof-sbloc", wrapId: "sof-sbloc-detail-wrap", inputId: "sof-sbloc-detail", value: "Margin loan / SBLOC" },
    { checkboxId: "sof-heloc", wrapId: "sof-heloc-detail-wrap", inputId: "sof-heloc-detail", value: "HELOC" },
    { checkboxId: "sof-sdira", wrapId: "sof-sdira-detail-wrap", inputId: "sof-sdira-detail", value: "SDIRA" },
    { checkboxId: "sof-personal-loan", wrapId: "sof-personal-loan-detail-wrap", inputId: "sof-personal-loan-detail", value: "Personal loan" },
    { checkboxId: "sof-other", wrapId: "sof-other-detail-wrap", inputId: "sof-other-detail", value: "Other" },
  ];

  const SOF_DETAIL_BY_VALUE = Object.fromEntries(
    SOF_DETAIL_FIELDS.map((field) => [field.value, field.inputId])
  );

  const KEY_UPDATE_TITLES = {
    "eb5-filed": "New case filed",
    "ead-ap-approval": "EAD/AP approval",
    "wom-filed": "WOM filed",
    "i526-approval": "I-526 approval",
    "i485-approval": "I-485 approval",
  };

  const KEY_UPDATE_CELEBRATIONS = {
    "eb5-filed": "Congratulations on filing your EB5 case! 🎉",
    "ead-ap-approval": "Congratulations on your EAD/AP approval! 🎉",
    "wom-filed": "Got it. Tracking your WOM filing update.",
    "i526-approval": "Congratulations on your I-526 approval! 🎉",
    "i485-approval": "Congratulations on your I-485 approval! 🎉",
  };

  const CELEBRATION_EMOJI = "🎉";
  const BTN_COLOR_NAMES = ["primary", "secondary", "accent", "info", "success", "warning", "error", "neutral"];
  const COPY_BTN_DEFAULT_HTML = copyBtn ? copyBtn.innerHTML : "Copy to clipboard";

  let comboCardValue = "";
  let previewManuallyEdited = false;
  let celebrationToastTimer = null;
  let restoreToastTimer = null;
  let copyBtnResetTimer = null;
  let saveFormTimer = null;
  let lastCelebratedKeyUpdate = "";
  let isRestoringForm = false;
  let mobilePreviewManuallyEdited = false;

  function isPending(pendingId) {
    const el = document.getElementById(pendingId);
    return Boolean(el && el.checked);
  }

  function isMonthsOnlyPrivacy() {
    return getRadioValue("datePrivacy") === "Months only";
  }

  function toLocalDateFromIso(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function isoFromLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getTodayIso() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isoFromLocalDate(today);
  }

  function isWithinLastWeek(isoDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = toLocalDateFromIso(isoDate);
    const diffDays = Math.round((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays <= 7;
  }

  function formatDate(isoDate) {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) return "";

    if (isMonthsOnlyPrivacy() && !isWithinLastWeek(parsed)) {
      const [year, month] = parsed.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    }

    const [year, month, day] = parsed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateWithPdOffset(isoDate, fieldId) {
    const actual = parseIsoDate(isoDate);
    if (!actual) return "";
    const formatted = formatDate(actual);
    if (!formatted) return "";
    if (fieldId === "priority-date") return formatted;
    if (isMonthsOnlyPrivacy()) return formatted;
    const offset = daysFromPriorityDate(actual);
    return offset ? `${formatted} (${offset})` : formatted;
  }

  function daysAfterPriorityDate(isoDate) {
    const priorityDate = parseIsoDate(getFieldValue("priority-date"));
    const eventDate = parseIsoDate(isoDate);
    if (!priorityDate || !eventDate) return "";

    const diffDays = getElapsedDays(priorityDate, eventDate);
    if (diffDays === null) return "";
    return formatElapsed(diffDays, { withSign: true, withFromPd: true }).replace(
      " from PD",
      " after PD"
    );
  }

  function getKeyUpdateReferenceDate(keyUpdate) {
    switch (keyUpdate) {
      case "eb5-filed":
        return getTodayIso();
      case "ead-ap-approval":
        if (!isPending("ead-approval-pending")) {
          const eadDate = parseIsoDate(getFieldValue("ead-approval"));
          if (eadDate) return eadDate;
        }
        if (!isPending("ap-approval-pending")) {
          return parseIsoDate(getFieldValue("ap-approval"));
        }
        return "";
      case "wom-filed":
        if (isWomNotFiled()) return "";
        return parseIsoDate(getFieldValue("wom-date"));
      case "i526-approval":
        if (isPending("i526-date-pending")) return "";
        return parseIsoDate(getFieldValue("i526-date"));
      case "i485-approval":
        if (isPending("i485-date-pending")) return "";
        return parseIsoDate(getFieldValue("i485-date"));
      default:
        return "";
    }
  }

  function getElapsedDays(fromIso, toIso) {
    const from = parseIsoDate(fromIso);
    const to = parseIsoDate(toIso);
    if (!from || !to) return null;

    return Math.round(
      (toLocalDateFromIso(to).getTime() - toLocalDateFromIso(from).getTime()) /
        (24 * 60 * 60 * 1000)
    );
  }

  /**
   * Tiered elapsed-time formatting from a day count.
   * < 30 days → days; ≥ 30 days → months via Math.round(days / 30.44).
   */
  function formatElapsed(diffDays, options = {}) {
    if (typeof diffDays !== "number" || Number.isNaN(diffDays)) return "";

    const { withSign = false, withFromPd = false } = options;
    const abs = Math.abs(diffDays);
    const sign = diffDays < 0 ? "-" : withSign ? "+" : "";

    let amount;
    if (abs < 30) {
      amount = `${abs} ${abs === 1 ? "day" : "days"}`;
    } else {
      const months = Math.round(abs / 30.44);
      amount = `${months} ${months === 1 ? "month" : "months"}`;
    }

    const base = `${sign}${amount}`;
    return withFromPd ? `${base} from PD` : base;
  }

  function buildTitleLine() {
    const keyUpdate = getRadioValue("keyUpdate");
    if (!keyUpdate) return "EB5 Status Update";

    const title = KEY_UPDATE_TITLES[keyUpdate];
    if (!title) return "EB5 Status Update";

    if (isMonthsOnlyPrivacy()) {
      return `EB5 Status Update: ${title}`;
    }

    const referenceDate = getKeyUpdateReferenceDate(keyUpdate);
    const elapsed = referenceDate ? daysAfterPriorityDate(referenceDate) : "";
    return elapsed
      ? `EB5 Status Update: ${title} (${elapsed})`
      : `EB5 Status Update: ${title}`;
  }

  function daysFromPriorityDate(isoDate) {
    const priorityDate = parseIsoDate(getFieldValue("priority-date"));
    const eventDate = parseIsoDate(isoDate);
    if (!priorityDate || !eventDate) return "";

    const diffDays = getElapsedDays(priorityDate, eventDate);
    if (diffDays === null) return "";
    return formatElapsed(diffDays, { withSign: true, withFromPd: true });
  }

  function formatPendingDateValue(inputId, pendingId) {
    if (isPending(pendingId)) return "Pending";
    return formatDateWithPdOffset(getFieldValue(inputId), inputId);
  }

  function formatApprovalValue(inputId, pendingId) {
    const formatted = formatPendingDateValue(inputId, pendingId);
    if (!formatted || formatted === "Pending") return formatted;
    return `${formatted} ${CELEBRATION_EMOJI}`;
  }

  function parseIsoDate(value) {
    const trimmed = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }
    return trimmed;
  }

  function getFieldValue(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return String(el.value).trim();
  }

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(
      (el) => el.value
    );
  }

  function getRadioValue(name) {
    const selected = form.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function showCopySuccess(button) {
    if (!button) return;

    button.classList.add("is-copied");
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';

    if (copyBtnResetTimer) clearTimeout(copyBtnResetTimer);
    copyBtnResetTimer = setTimeout(() => {
      button.classList.remove("is-copied");
      if (button === copyBtn) {
        button.innerHTML = COPY_BTN_DEFAULT_HTML;
      } else {
        button.textContent = "Copy to clipboard";
      }
    }, 2000);
  }

  function countFilledFields() {
    let count = 0;

    form.querySelectorAll('input[type="text"]:not([disabled])').forEach((input) => {
      if (input.value.trim()) count += 1;
    });

    form.querySelectorAll(".pending-date-toggle:checked").forEach(() => {
      count += 1;
    });

    const countedRadioGroups = new Set();
    form.querySelectorAll('input[type="radio"]:checked').forEach((input) => {
      if (countedRadioGroups.has(input.name)) return;
      countedRadioGroups.add(input.name);
      count += 1;
    });

    form.querySelectorAll('input[type="checkbox"]:checked').forEach((input) => {
      if (input.classList.contains("pending-date-toggle")) return;
      count += 1;
    });

    if (getComboCardValue()) count += 1;

    return count;
  }

  function getFromPdStatValue(keyUpdate) {
    if (isMonthsOnlyPrivacy()) return "—";
    if (!keyUpdate) return "—";

    const priorityDate = parseIsoDate(getFieldValue("priority-date"));
    const referenceDate = getKeyUpdateReferenceDate(keyUpdate);
    if (!priorityDate || !referenceDate) return "—";

    const diffDays = getElapsedDays(priorityDate, referenceDate);
    if (diffDays === null) return "—";
    return formatElapsed(diffDays);
  }

  function updatePreviewStats() {
    const keyUpdate = getRadioValue("keyUpdate");
    const filledCount = countFilledFields();
    const fromPdValue = getFromPdStatValue(keyUpdate);

    if (statKeyUpdate) {
      statKeyUpdate.textContent = keyUpdate ? KEY_UPDATE_TITLES[keyUpdate] || "—" : "—";
    }

    if (statDaysPd) {
      statDaysPd.textContent = fromPdValue;
    }

    if (statFieldsFilled) {
      statFieldsFilled.textContent = String(filledCount);
    }

    if (progressFill) {
      const pct = Math.min(100, (filledCount / PROGRESS_MAX_FIELDS) * 100);
      progressFill.style.width = `${pct}%`;
    }

    const progressCount = document.getElementById("progress-count");
    if (progressCount) {
      progressCount.textContent = `${filledCount}/${PROGRESS_MAX_FIELDS}`;
    }

    if (fabFieldCount) {
      fabFieldCount.textContent = String(filledCount);
    }

    const mobileStatFields = document.getElementById("mobile-stat-fields-filled");
    const mobileStatKey = document.getElementById("mobile-stat-key-update");
    const mobileStatDays = document.getElementById("mobile-stat-days-pd");
    if (mobileStatFields) mobileStatFields.textContent = String(filledCount);
    if (mobileStatKey) {
      mobileStatKey.textContent = keyUpdate ? KEY_UPDATE_TITLES[keyUpdate] || "—" : "—";
    }
    if (mobileStatDays) {
      mobileStatDays.textContent = fromPdValue;
    }
  }

  function showCelebrationToast(message) {
    if (!celebrationToast || !celebrationToastText || !message) return;

    celebrationToastText.textContent = message;
    celebrationToast.classList.add("is-visible");
    celebrationToast.setAttribute("aria-hidden", "false");

    if (celebrationToastTimer) clearTimeout(celebrationToastTimer);
    celebrationToastTimer = setTimeout(() => {
      celebrationToast.classList.remove("is-visible");
      celebrationToast.setAttribute("aria-hidden", "true");
    }, 3500);
  }

  function showRestoreToast() {
    if (!restoreToast) return;

    restoreToast.classList.add("is-visible");
    restoreToast.setAttribute("aria-hidden", "false");

    if (restoreToastTimer) clearTimeout(restoreToastTimer);
    restoreToastTimer = setTimeout(() => {
      restoreToast.classList.remove("is-visible");
      restoreToast.setAttribute("aria-hidden", "true");
    }, 3000);
  }

  function handleKeyUpdateCelebration() {
    const keyUpdate = getRadioValue("keyUpdate");
    if (!keyUpdate) {
      lastCelebratedKeyUpdate = "";
      return;
    }
    if (keyUpdate === lastCelebratedKeyUpdate) return;

    const message = KEY_UPDATE_CELEBRATIONS[keyUpdate];
    if (!message) return;

    lastCelebratedKeyUpdate = keyUpdate;
    showCelebrationToast(message);
  }

  function initKeyUpdateCelebration() {
    form.querySelectorAll('input[name="keyUpdate"]').forEach((radio) => {
      radio.addEventListener("click", () => {
        setTimeout(handleKeyUpdateCelebration, 0);
      });
    });
  }

  function filterSuggestions(suggestions, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suggestions;
    return suggestions.filter((item) => item.toLowerCase().includes(normalized));
  }

  function supportsPopoverApi() {
    return typeof HTMLElement.prototype.showPopover === "function";
  }

  function supportsAnchorPositioning() {
    return typeof CSS !== "undefined" && CSS.supports("anchor-name", "--test");
  }

  function initAutocomplete(inputId, listId, suggestions) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const wrap = input?.closest(".autocomplete-wrap");
    if (!input || !list || !wrap || !suggestions.length) return;

    const usePopover = supportsPopoverApi();
    if (usePopover) {
      list.setAttribute("popover", "auto");
    }

    let activeIndex = -1;

    function positionDropdownFallback() {
      const rect = input.getBoundingClientRect();
      list.style.position = "fixed";
      list.style.left = `${rect.left}px`;
      list.style.top = `${rect.bottom + 4}px`;
      list.style.width = `${rect.width}px`;
    }

    function onViewportChange() {
      if (!list.classList.contains("hidden") && !supportsAnchorPositioning()) {
        positionDropdownFallback();
      }
    }

    function hideSuggestions() {
      if (usePopover && list.matches(":popover-open") && typeof list.hidePopover === "function") {
        list.hidePopover();
      }
      list.classList.add("hidden");
      list.innerHTML = "";
      activeIndex = -1;
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    }

    function selectSuggestion(value) {
      input.value = value;
      hideSuggestions();
      updatePreviewFromFormIfAllowed();
      scheduleFormSave();
    }

    function renderSuggestions(items) {
      list.innerHTML = "";
      activeIndex = -1;

      if (!items.length) {
        hideSuggestions();
        return;
      }

      items.forEach((item, index) => {
        const option = document.createElement("li");
        option.className = "autocomplete-option";
        option.textContent = item;
        option.setAttribute("role", "option");
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          selectSuggestion(item);
        });
        option.addEventListener("mouseenter", () => {
          activeIndex = index;
          list.querySelectorAll(".autocomplete-option").forEach((el, idx) => {
            el.classList.toggle("is-active", idx === activeIndex);
          });
        });
        list.appendChild(option);
      });

      list.classList.remove("hidden");
      if (!supportsAnchorPositioning()) {
        positionDropdownFallback();
        window.addEventListener("scroll", onViewportChange, true);
        window.addEventListener("resize", onViewportChange);
      }
      if (usePopover && typeof list.showPopover === "function") {
        list.showPopover();
      }
    }

    function updateSuggestions() {
      renderSuggestions(filterSuggestions(suggestions, input.value));
    }

    input.addEventListener("input", updateSuggestions);
    input.addEventListener("focus", updateSuggestions);
    input.addEventListener("blur", () => {
      setTimeout(hideSuggestions, 150);
    });
    input.addEventListener("keydown", (event) => {
      const options = Array.from(list.querySelectorAll(".autocomplete-option"));
      if (!options.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        selectSuggestion(options[activeIndex].textContent);
        return;
      } else if (event.key === "Escape") {
        hideSuggestions();
        return;
      } else {
        return;
      }

      options.forEach((el, idx) => {
        el.classList.toggle("is-active", idx === activeIndex);
        if (idx === activeIndex) {
          el.scrollIntoView({ block: "nearest" });
        }
      });
    });

    list.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    list.addEventListener("toggle", () => {
      if (!list.matches(":popover-open")) {
        list.classList.add("hidden");
      }
    });
  }

  async function initAutocompleteFields() {
    const loadJson = async (path, fallback) => {
      try {
        const response = await fetch(path);
        if (!response.ok) return fallback;
        const data = await response.json();
        return Array.isArray(data) ? data : fallback;
      } catch {
        return fallback;
      }
    };

    const [regionalCenters, attorneys] = await Promise.all([
      loadJson("./data/regional-centers.json", []),
      loadJson("./data/attorneys.json", []),
    ]);

    initAutocomplete("regional-center", "regional-center-suggestions", regionalCenters);
    initAutocomplete("attorney", "attorney-suggestions", attorneys);
    initAutocomplete("wom-attorney-name", "wom-attorney-name-suggestions", attorneys);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    themeToggle.checked = saved === "light";

    themeToggle.addEventListener("change", () => {
      const next = themeToggle.checked ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function syncCalendarFromInput(input, calendar) {
    const parsed = parseIsoDate(input.value);
    if (parsed) {
      calendar.value = parsed;
      return;
    }
    if (!input.value.trim()) {
      calendar.value = "";
    }
  }

  const CALENDAR_MIN_DATE = "2020-01-01";

  function getCalendarMaxDate() {
    return `${new Date().getFullYear()}-12-31`;
  }

  function applyCalendarBounds(calendar) {
    calendar.setAttribute("min", CALENDAR_MIN_DATE);
    calendar.setAttribute("max", getCalendarMaxDate());
  }

  function enhanceCalendarNavigation(calendar) {
    applyCalendarBounds(calendar);
    if (calendar.querySelector("calendar-select-month")) return;

    const monthSelect = document.createElement("calendar-select-month");
    monthSelect.setAttribute("slot", "heading");
    monthSelect.setAttribute("format-month", "short");

    const yearSelect = document.createElement("calendar-select-year");
    yearSelect.setAttribute("slot", "heading");

    const monthEl = calendar.querySelector("calendar-month");
    if (!monthEl) return;

    calendar.insertBefore(yearSelect, monthEl);
    calendar.insertBefore(monthSelect, yearSelect);
  }

  function initCallyDatePickers() {
    DATE_FIELD_IDS.forEach((inputId) => {
      const input = document.getElementById(inputId);
      const calendar = document.querySelector(`calendar-date[data-input-id="${inputId}"]`);
      if (!input || !calendar) return;

      enhanceCalendarNavigation(calendar);

      const popover = calendar.closest("[popover]");

      calendar.addEventListener("change", () => {
        if (calendar.value) {
          input.value = calendar.value;
          updateConditionalSections();
          updatePreviewFromFormIfAllowed();
          scheduleFormSave();
        }
        if (popover && typeof popover.hidePopover === "function") {
          popover.hidePopover();
        }
      });

      input.addEventListener("input", () => {
        syncCalendarFromInput(input, calendar);
        updateConditionalSections();
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });

      input.addEventListener("blur", () => {
        const parsed = parseIsoDate(input.value);
        if (parsed) {
          input.value = parsed;
          calendar.value = parsed;
        }
      });
    });
  }

  function getComboCardValue() {
    return comboCardValue;
  }

  function getButtonColor(el) {
    return el.dataset.btnColor || "primary";
  }

  function clearButtonColorClasses(el) {
    BTN_COLOR_NAMES.forEach((color) => {
      el.classList.remove(`btn-${color}`, "btn-soft", "btn-active");
    });
  }

  function setSelectedButtonStyle(el) {
    const color = getButtonColor(el);
    clearButtonColorClasses(el);
    el.classList.add(`btn-${color}`, "btn-active");
  }

  function setUnselectedButtonStyle(el) {
    const color = getButtonColor(el);
    clearButtonColorClasses(el);
    el.classList.add("btn-soft", `btn-${color}`);
  }

  function setComboCardValue(value) {
    comboCardValue = value;
    comboCardToggle.querySelectorAll("[data-value]").forEach((option) => {
      const isSelected = option.dataset.value === value;
      if (isSelected) {
        setSelectedButtonStyle(option);
      } else {
        setUnselectedButtonStyle(option);
      }
      option.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function initComboCardToggle() {
    comboCardToggle.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;

      const nextValue = option.dataset.value;
      setComboCardValue(comboCardValue === nextValue ? "" : nextValue);
      updatePreviewFromFormIfAllowed();
      scheduleFormSave();
    });
  }

  function syncChoiceButton(input) {
    const label = input.closest("label.choice-btn");
    if (label) return;
    if (input.checked) {
      setSelectedButtonStyle(input.closest("label") || input);
    } else {
      setUnselectedButtonStyle(input.closest("label") || input);
    }
  }

  function syncRadioGroup(groupName) {
    form.querySelectorAll(`input[name="${groupName}"]`).forEach((radio) => {
      syncChoiceButton(radio);
    });
  }

  function syncAllChoiceButtons() {
    form.querySelectorAll("label.choice-btn input").forEach((input) => {
      syncChoiceButton(input);
    });
    syncRadioGroup("i526Status");
    syncRadioGroup("womCounsel");
    syncRadioGroup("womStatus");
    syncRadioGroup("applicationLocation");
    syncRadioGroup("keyUpdate");
    syncRadioGroup("usedAgent");
    syncRadioGroup("datePrivacy");
  }

  function initChoiceButtons() {
    form.querySelectorAll("label.choice-btn input").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.type === "radio") {
          syncRadioGroup(input.name);
        } else {
          syncChoiceButton(input);
        }
      });
    });
    syncAllChoiceButtons();
  }

  function initOptionalRadioDeselect(groupName) {
    form.querySelectorAll(`input[name="${groupName}"]`).forEach((radio) => {
      radio.addEventListener("click", () => {
        if (radio.dataset.wasChecked === "true") {
          radio.checked = false;
          radio.dataset.wasChecked = "false";
          syncRadioGroup(groupName);
          updatePreviewFromFormIfAllowed();
          scheduleFormSave();
          return;
        }

        form.querySelectorAll(`input[name="${groupName}"]`).forEach((item) => {
          item.dataset.wasChecked = "false";
        });
        radio.dataset.wasChecked = "true";
        syncRadioGroup(groupName);
      });
    });
  }

  function getProjectCategory() {
    return getCheckedValues("projectCategory").join(", ");
  }

  function initProjectCategory() {
    form.querySelectorAll('input[name="projectCategory"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        syncChoiceButton(checkbox);
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });
    });
  }

  function getWomCounselLine() {
    const counsel = getRadioValue("womCounsel");
    if (!counsel) return "";
    if (counsel === "Attorney") {
      const name = getFieldValue("wom-attorney-name");
      return name ? `Attorney (${name})` : "Attorney";
    }
    return counsel;
  }

  function hasI526PreviewContext() {
    return isPending("i526-date-pending") || Boolean(getFieldValue("i526-date"));
  }

  function hasI526StatusContext() {
    if (isPending("i526-date-pending")) return false;
    return Boolean(parseIsoDate(getFieldValue("i526-date")));
  }

  function hasI526AdverseContext() {
    return hasI526StatusContext() && I526_ADVERSE_STATUSES.has(getRadioValue("i526Status"));
  }

  function getI526ReasonLabel() {
    const status = getRadioValue("i526Status");
    if (status === "RFE") return "RFE reason";
    if (status === "NOID") return "NOID reason";
    if (status === "Denied") return "Denial reason";
    return "";
  }

  function isI956fPending() {
    const el = document.getElementById("i956f-pending");
    return Boolean(el && el.checked);
  }

  function isI956fApprovedBeforePd() {
    const el = document.getElementById("i956f-approved-before-pd");
    return Boolean(el && el.checked);
  }

  function isI956fDateDisabled() {
    return isI956fPending() || isI956fApprovedBeforePd();
  }

  function isWomNotFiled() {
    return isPending("wom-date-not-filed");
  }

  function hasWomDateContext() {
    if (isWomNotFiled()) return false;
    return Boolean(parseIsoDate(getFieldValue("wom-date")));
  }

  function hasWomPreviewContext() {
    if (isWomNotFiled()) return true;
    return Boolean(getFieldValue("wom-date"));
  }

  function getWomFiledOnValue() {
    if (isWomNotFiled()) return "Not filed";
    return formatDateWithPdOffset(getFieldValue("wom-date"), "wom-date");
  }

  function getWomFiledForValue() {
    return getCheckedValues("wom").join(", ");
  }

  function getWomStatusLine() {
    const status = getRadioValue("womStatus");
    if (!status || !hasWomDateContext()) return "";
    if (status === "Resolved" || status === "Dismissed") {
      const resDate = formatDateWithPdOffset(
        getFieldValue("wom-resolution-date"),
        "wom-resolution-date"
      );
      const prefix = status === "Dismissed" ? "WOM dismissed" : "WOM resolution";
      return resDate ? `${prefix}: ${resDate}` : `${prefix}`;
    }
    return `WOM status: ${status}`;
  }

  function getI956fLine() {
    if (isI956fPending()) return "I-956F: Pending";
    if (isI956fApprovedBeforePd()) return "I-956F: Approved before PD";
    const formatted = formatDateWithPdOffset(getFieldValue("i956f-approval"), "i956f-approval");
    if (!formatted) return "";
    return `I-956F approved: ${formatted} ${CELEBRATION_EMOJI}`;
  }

  function ensureDefaultI526Approved() {
    if (!form.querySelector('input[name="i526Status"]:checked')) {
      const approved = form.querySelector('input[name="i526Status"][value="Approved"]');
      if (approved) {
        approved.checked = true;
        syncRadioGroup("i526Status");
      }
    }
  }

  function clearWomDetails() {
    form.querySelectorAll('input[name="wom"]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    form.querySelectorAll('input[name="womCounsel"]').forEach((radio) => {
      radio.checked = false;
      radio.dataset.wasChecked = "false";
    });
    form.querySelectorAll('input[name="womStatus"]').forEach((radio) => {
      radio.checked = false;
      radio.dataset.wasChecked = "false";
    });
    const attorneyInput = document.getElementById("wom-attorney-name");
    const courtInput = document.getElementById("wom-court");
    const resolutionInput = document.getElementById("wom-resolution-date");
    if (attorneyInput) attorneyInput.value = "";
    if (courtInput) courtInput.value = "";
    if (resolutionInput) resolutionInput.value = "";
    syncAllChoiceButtons();
    updateWomResolutionVisibility();
  }

  function clearI526Reason() {
    const reasonInput = document.getElementById("i526-reason");
    if (reasonInput) reasonInput.value = "";
  }

  function clearI956fDate() {
    const input = document.getElementById("i956f-approval");
    const calendar = document.querySelector('calendar-date[data-input-id="i956f-approval"]');
    if (input) input.value = "";
    if (calendar) calendar.value = "";
  }

  function syncI956fDateState() {
    const wrap = document.getElementById("i956f-approval-wrap");
    const input = document.getElementById("i956f-approval");
    if (!wrap || !input) return;

    const disabled = isI956fDateDisabled();
    if (disabled) {
      input.value = "";
      input.disabled = true;
      wrap.classList.add("is-disabled");
      wrap.querySelector("button[popovertarget]")?.setAttribute("disabled", "");
      const calendar = document.querySelector('calendar-date[data-input-id="i956f-approval"]');
      if (calendar) calendar.value = "";
    } else {
      input.disabled = false;
      wrap.classList.remove("is-disabled");
      wrap.querySelector("button[popovertarget]")?.removeAttribute("disabled");
    }
  }

  function initI956fStateToggles() {
    const pendingToggle = document.getElementById("i956f-pending");
    const beforePdToggle = document.getElementById("i956f-approved-before-pd");
    if (!pendingToggle || !beforePdToggle) return;

    const handleToggle = (activeToggle) => {
      if (activeToggle.checked) {
        if (activeToggle === pendingToggle) beforePdToggle.checked = false;
        if (activeToggle === beforePdToggle) pendingToggle.checked = false;
      }
      syncI956fDateState();
      updatePreviewFromFormIfAllowed();
      scheduleFormSave();
    };

    pendingToggle.addEventListener("change", () => handleToggle(pendingToggle));
    beforePdToggle.addEventListener("change", () => handleToggle(beforePdToggle));
    syncI956fDateState();
  }

  function updateI526StatusVisibility() {
    const wrap = document.getElementById("i526-status-wrap");
    if (!wrap) return;
    const show = hasI526StatusContext();
    wrap.classList.toggle("hidden", !show);
    if (show) ensureDefaultI526Approved();
    updateI526ReasonVisibility();
  }

  function updateI526ReasonVisibility() {
    const wrap = document.getElementById("i526-reason-wrap");
    const label = document.getElementById("i526-reason-label");
    if (!wrap) return;
    const show = hasI526AdverseContext();
    wrap.classList.toggle("hidden", !show);
    if (label) {
      label.textContent = getI526ReasonLabel() || "Reason";
    }
    if (!show) clearI526Reason();
  }

  function updateWomDetailsVisibility() {
    const wrap = document.getElementById("wom-details-wrap");
    if (!wrap) return;
    const show = hasWomDateContext();
    wrap.classList.toggle("hidden", !show);
    if (!show) clearWomDetails();
    else updateWomResolutionVisibility();
  }

  function updateWomResolutionVisibility() {
    const wrap = document.getElementById("wom-resolution-wrap");
    const label = document.getElementById("wom-resolution-date-label");
    if (!wrap) return;
    const status = getRadioValue("womStatus");
    const show = hasWomDateContext() && (status === "Resolved" || status === "Dismissed");
    wrap.classList.toggle("hidden", !show);
    if (label) {
      label.textContent =
        status === "Dismissed" ? "WOM Dismissal Date" : "WOM Resolution Date";
    }
    if (!show) {
      const input = document.getElementById("wom-resolution-date");
      if (input) input.value = "";
    }
  }

  function getUsedAgentLine() {
    const usedAgent = getRadioValue("usedAgent");
    if (!usedAgent) return "";
    if (usedAgent === "Yes") {
      const name = getFieldValue("agent-name");
      return name ? `Yes (${name})` : "Yes";
    }
    return usedAgent;
  }

  function updateAgentNameVisibility() {
    const wrap = document.getElementById("agent-name-wrap");
    if (!wrap) return;
    const show = getRadioValue("usedAgent") === "Yes";
    wrap.classList.toggle("hidden", !show);
    if (!show) {
      const input = document.getElementById("agent-name");
      if (input) input.value = "";
    }
  }

  function updateWomAttorneyVisibility() {
    const wrap = document.getElementById("wom-attorney-name-wrap");
    if (!wrap) return;
    const show = getRadioValue("womCounsel") === "Attorney";
    wrap.classList.toggle("hidden", !show);
    if (!show) {
      const input = document.getElementById("wom-attorney-name");
      if (input) input.value = "";
    }
  }

  function hasApprovalDate(inputId, pendingId) {
    if (isPending(pendingId)) return false;
    return Boolean(parseIsoDate(getFieldValue(inputId)));
  }

  function hasEadAndApApprovalDates() {
    return (
      hasApprovalDate("ead-approval", "ead-approval-pending") &&
      hasApprovalDate("ap-approval", "ap-approval-pending")
    );
  }

  function updateComboCardVisibility() {
    const wrap = document.getElementById("combo-card-wrap");
    if (!wrap) return;
    const show = hasEadAndApApprovalDates();
    wrap.classList.toggle("hidden", !show);
    if (!show) setComboCardValue("");
  }

  function updateConditionalSections() {
    updateI526StatusVisibility();
    updateWomDetailsVisibility();
    updateWomAttorneyVisibility();
    updateWomResolutionVisibility();
    updateAgentNameVisibility();
    updateComboCardVisibility();
  }

  function setPendingState(toggle) {
    const dateId = toggle.dataset.dateId;
    const wrapId = toggle.dataset.wrapId;
    const input = document.getElementById(dateId);
    const wrap = document.getElementById(wrapId);
    if (!input || !wrap) return;

    const pending = toggle.checked;
    if (pending) {
      input.value = "";
      input.disabled = true;
      wrap.classList.add("is-disabled");
      wrap.querySelector("button[popovertarget]")?.setAttribute("disabled", "");
    } else {
      input.disabled = false;
      wrap.classList.remove("is-disabled");
      wrap.querySelector("button[popovertarget]")?.removeAttribute("disabled");
    }
    updateConditionalSections();
    updatePreviewFromFormIfAllowed();
    scheduleFormSave();
  }

  function initPendingDateToggles() {
    form.querySelectorAll(".pending-date-toggle").forEach((toggle) => {
      toggle.addEventListener("change", () => setPendingState(toggle));
    });
  }

  function initConditionalSections() {
    form.querySelectorAll('input[name="womCounsel"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateWomAttorneyVisibility();
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });
    });
    form.querySelectorAll('input[name="womStatus"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateWomResolutionVisibility();
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });
    });
    form.querySelectorAll('input[name="i526Status"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateI526ReasonVisibility();
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });
    });
    form.querySelectorAll('input[name="usedAgent"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateAgentNameVisibility();
        updatePreviewFromFormIfAllowed();
        scheduleFormSave();
      });
    });
    updateConditionalSections();
  }

  function getSofComposition() {
    return getCheckedValues("sof")
      .map((value) => {
        const detailInputId = SOF_DETAIL_BY_VALUE[value];
        if (!detailInputId) return value;
        const detail = getFieldValue(detailInputId);
        return detail ? `${value} (${detail})` : value;
      })
      .join(", ");
  }

  function toggleSofConditionalDetails() {
    SOF_DETAIL_FIELDS.forEach(({ checkboxId, wrapId, inputId }) => {
      const checkbox = document.getElementById(checkboxId);
      const wrap = document.getElementById(wrapId);
      const detailInput = document.getElementById(inputId);
      if (!checkbox || !wrap || !detailInput) return;

      const show = checkbox.checked;
      wrap.classList.toggle("hidden", !show);
      if (!show) detailInput.value = "";
    });
  }

  function initSofConditionalDetails() {
    form.querySelectorAll('input[name="sof"]').forEach((checkbox) => {
      checkbox.addEventListener("change", toggleSofConditionalDetails);
    });
    toggleSofConditionalDetails();
  }

  function hasPreviewContent() {
    return preview.value.trim().length > 0;
  }

  function updateCopyButton() {
    const hasContent = hasPreviewContent();
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (copyBtn) copyBtn.disabled = !hasContent;
    if (mobileCopyBtn) mobileCopyBtn.disabled = !hasContent;
    if (previewFab) previewFab.classList.toggle("hidden", !hasContent || isDesktop);
  }

  const SHARE_URL = "https://bit.ly/eb5status";
  const SHARE_URL_SHORT = "bit.ly/eb5status";
  const SHARE_TITLE = "EB5 Status Update Builder";
  const SHARE_TEXT = "Check out this tool for sharing your EB-5 case status";
  let shareBtnResetTimer = null;

  function showShareCopied(button) {
    if (!button) return;
    const original = button.innerHTML;
    button.classList.add("is-copied");
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Link copied!';

    if (shareBtnResetTimer) clearTimeout(shareBtnResetTimer);
    shareBtnResetTimer = setTimeout(() => {
      button.classList.remove("is-copied");
      button.innerHTML = original;
    }, 2000);
  }

  async function shareAppLink(button) {
    const canNativeShare =
      typeof navigator.share === "function" &&
      (!navigator.canShare ||
        navigator.canShare({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL }));

    if (canNativeShare && (window.matchMedia("(max-width: 1023px)").matches || "ontouchstart" in window)) {
      try {
        await navigator.share({
          title: SHARE_TITLE,
          text: SHARE_TEXT,
          url: SHARE_URL,
        });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        /* fall through to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(SHARE_URL_SHORT);
      showShareCopied(button);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = SHARE_URL_SHORT;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showShareCopied(button);
    }
  }

  function initShareButtons() {
    ["share-btn", "mobile-share-btn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        shareAppLink(btn);
      });
    });
  }

  function updateRefreshButton() {
    const show = previewManuallyEdited;
    refreshBtn.hidden = !show;
    refreshBtn.classList.toggle("hidden", !show);
  }

  const I526_STATUS_LABELS = {
    Approved: "approved",
    RFE: "RFE",
    NOID: "NOID",
    Denied: "denied",
  };

  function buildI526Line(status, date, pending) {
    if (pending && !parseIsoDate(date)) {
      return "I-526: Pending";
    }

    const formattedDate = formatDateWithPdOffset(date, "i526-date");
    if (!status && !formattedDate) return null;
    if (!status && formattedDate) return `I-526 adjudication date: ${formattedDate}`;

    const label = I526_STATUS_LABELS[status] || status;
    if (status && formattedDate) {
      const line = `I-526 ${label}: ${formattedDate}`;
      return status === "Approved" ? `${line} ${CELEBRATION_EMOJI}` : line;
    }
    if (status) {
      const line = `I-526 ${label}`;
      return status === "Approved" ? `${line} ${CELEBRATION_EMOJI}` : line;
    }
    return null;
  }

  function generateMessage() {
    const bulletLines = [];

    const i956fLine = getI956fLine();

    const entries = [
      ["Priority date", formatDateWithPdOffset(getFieldValue("priority-date"), "priority-date")],
      [null, i956fLine],
      ["Project category", getProjectCategory()],
      ["Regional Center", getFieldValue("regional-center")],
      ["Project", getFieldValue("project-name")],
      ["Immigration attorney", getFieldValue("attorney")],
      ["Used agent", getUsedAgentLine()],
      ["Service center", getRadioValue("applicationLocation")],
      ["Biometric notice", formatPendingDateValue("biometric-notice", "biometric-notice-pending")],
      ["EAD approved", formatApprovalValue("ead-approval", "ead-approval-pending")],
      ["AP approved", formatApprovalValue("ap-approval", "ap-approval-pending")],
      ["Combo card", hasEadAndApApprovalDates() ? getComboCardValue() : ""],
      [
        null,
        hasI526PreviewContext()
          ? buildI526Line(
              isPending("i526-date-pending") ? "" : getRadioValue("i526Status"),
              getFieldValue("i526-date"),
              isPending("i526-date-pending")
            )
          : null,
      ],
      [
        getI526ReasonLabel(),
        hasI526AdverseContext() ? getFieldValue("i526-reason") : "",
      ],
      ["WOM filed on", hasWomPreviewContext() ? getWomFiledOnValue() : ""],
      ["WOM filed for", hasWomDateContext() ? getWomFiledForValue() : ""],
      ["WOM counsel", hasWomDateContext() ? getWomCounselLine() : ""],
      ["WOM court", hasWomDateContext() ? getFieldValue("wom-court") : ""],
      [null, hasWomDateContext() ? getWomStatusLine() : ""],
      ["I-485 approved", formatApprovalValue("i485-date", "i485-date-pending")],
      ["SOF composition", getSofComposition()],
    ];

    for (const [label, value] of entries) {
      if (!value) continue;
      bulletLines.push(label ? `${label}: ${value}` : value);
    }

    if (!getRadioValue("keyUpdate") || bulletLines.length === 0) return "";

    const footerLines = ["Generated via bit.ly/eb5status"];
    if (isMonthsOnlyPrivacy()) {
      footerLines.push("Dates shown as month/year for privacy.");
    }

    return [
      buildTitleLine(),
      "",
      ...bulletLines.map((line) => `• ${line}`),
      "",
      ...footerLines,
    ].join("\n");
  }

  function syncMobilePreview() {
    if (!mobilePreview) return;
    if (!mobilePreviewManuallyEdited) {
      mobilePreview.value = preview.value;
    }
  }

  function updatePreviewPanelVisibility() {
    if (!previewPanel) return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

    // Desktop: always show the preview panel (no layout shift on first input).
    // Mobile: keep the panel hidden; preview is accessed via the FAB / bottom sheet.
    if (isDesktop) {
      previewPanel.classList.remove("hidden");
    } else {
      previewPanel.classList.add("hidden");
    }
  }

  function updatePreviewFromFormIfAllowed() {
    if (!previewManuallyEdited) {
      preview.value = generateMessage();
    }
    syncMobilePreview();
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
    if (!isRestoringForm) scheduleFormSave();
  }

  function syncPreviewFromForm() {
    preview.value = generateMessage();
    previewManuallyEdited = false;
    mobilePreviewManuallyEdited = false;
    syncMobilePreview();
    updateRefreshButton();
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
  }

  function collectFormState() {
    const state = {
      version: 2,
      comboCardValue,
      fields: {},
      radios: {},
      checkboxes: {},
    };

    form.querySelectorAll("input, textarea, select").forEach((el) => {
      if (!el.name && !el.id) return;
      const key = el.name || el.id;

      if (el.type === "radio") {
        if (el.checked) state.radios[el.name] = el.value;
        return;
      }

      if (el.type === "checkbox") {
        if (el.name) {
          if (!state.checkboxes[el.name]) state.checkboxes[el.name] = [];
          if (el.checked) state.checkboxes[el.name].push(el.value);
        } else if (el.id) {
          state.fields[el.id] = el.checked;
        }
        return;
      }

      if (el.id) {
        state.fields[el.id] = el.value;
      }
    });

    return state;
  }

  function restoreFormState(state) {
    if (!state || typeof state !== "object") return false;

    isRestoringForm = true;

    form.querySelectorAll('input[type="text"], textarea').forEach((el) => {
      if (el.id && state.fields && el.id in state.fields) {
        el.value = state.fields[el.id];
      }
    });

    form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (el.name && state.checkboxes && state.checkboxes[el.name]) {
        el.checked = state.checkboxes[el.name].includes(el.value);
      } else if (el.id && state.fields && el.id in state.fields) {
        el.checked = Boolean(state.fields[el.id]);
      }
    });

    form.querySelectorAll('input[type="radio"]').forEach((el) => {
      el.checked = false;
      el.dataset.wasChecked = "false";
    });

    if (state.radios) {
      Object.entries(state.radios).forEach(([name, value]) => {
        const radio = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
        if (radio) {
          radio.checked = true;
          radio.dataset.wasChecked = "true";
        }
      });
    }

    if (state.comboCardValue !== undefined) {
      setComboCardValue(state.comboCardValue || "");
    }

    form.querySelectorAll(".pending-date-toggle").forEach((toggle) => {
      setPendingState(toggle);
    });

    syncI956fDateState();

    DATE_FIELD_IDS.forEach((inputId) => {
      const input = document.getElementById(inputId);
      const calendar = document.querySelector(`calendar-date[data-input-id="${inputId}"]`);
      if (input && calendar) syncCalendarFromInput(input, calendar);
    });

    syncAllChoiceButtons();
    updateConditionalSections();
    previewManuallyEdited = false;
    mobilePreviewManuallyEdited = false;
    lastCelebratedKeyUpdate = getRadioValue("keyUpdate");
    updatePreviewFromFormIfAllowed();
    isRestoringForm = false;

    return true;
  }

  function scheduleFormSave() {
    if (isRestoringForm) return;
    if (saveFormTimer) clearTimeout(saveFormTimer);
    saveFormTimer = setTimeout(() => {
      try {
        localStorage.setItem(FORM_STATE_KEY, JSON.stringify(collectFormState()));
      } catch {
        /* ignore quota errors */
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function loadFormState() {
    try {
      const raw = localStorage.getItem(FORM_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (restoreFormState(state)) {
        showRestoreToast();
      }
    } catch {
      /* ignore corrupt state */
    }
  }

  function clearForm() {
    form.reset();
    comboCardValue = "";
    setComboCardValue("");
    previewManuallyEdited = false;
    mobilePreviewManuallyEdited = false;
    lastCelebratedKeyUpdate = "";

    form.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.dataset.wasChecked = "false";
    });

    const exactDates = form.querySelector('input[name="datePrivacy"][value="Exact dates"]');
    if (exactDates) {
      exactDates.checked = true;
      exactDates.dataset.wasChecked = "true";
    }

    form.querySelectorAll(".pending-date-toggle").forEach((toggle) => {
      toggle.checked = false;
      setPendingState(toggle);
    });

    const i956fPending = document.getElementById("i956f-pending");
    const i956fBeforePd = document.getElementById("i956f-approved-before-pd");
    if (i956fPending) i956fPending.checked = false;
    if (i956fBeforePd) i956fBeforePd.checked = false;
    syncI956fDateState();

    DATE_FIELD_IDS.forEach((inputId) => {
      const input = document.getElementById(inputId);
      const calendar = document.querySelector(`calendar-date[data-input-id="${inputId}"]`);
      if (input) input.value = "";
      if (calendar) calendar.value = "";
    });

    try {
      localStorage.removeItem(FORM_STATE_KEY);
    } catch {
      /* ignore */
    }

    syncAllChoiceButtons();
    updateConditionalSections();
    updatePreviewFromFormIfAllowed();
  }

  function initClearForm() {
    const modal = document.getElementById("clear-form-modal");
    const confirmBtn = document.getElementById("clear-form-confirm");
    const handlers = [clearFormBtn, document.getElementById("clear-form-btn-footer")].filter(Boolean);

    const openModal = () => {
      if (modal && typeof modal.showModal === "function") {
        modal.showModal();
      } else if (modal) {
        modal.setAttribute("open", "");
      }
    };

    handlers.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        openModal();
      });
    });

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        clearForm();
        if (modal && typeof modal.close === "function") {
          modal.close();
        } else if (modal) {
          modal.removeAttribute("open");
        }
      });
    }
  }

  function openPreviewSheet() {
    syncMobilePreview();
    updatePreviewStats();
    if (!previewSheet) return;

    if (typeof previewSheet.showPopover === "function") {
      try {
        previewSheet.showPopover();
        return;
      } catch {
        /* fall through to class-based fallback */
      }
    }

    previewSheet.classList.add("is-open");
    document.getElementById("preview-sheet-backdrop")?.classList.add("is-open");
    document.body.classList.add("overflow-hidden");
  }

  function closePreviewSheet() {
    if (!previewSheet) return;

    if (typeof previewSheet.hidePopover === "function") {
      try {
        if (previewSheet.matches(":popover-open")) {
          previewSheet.hidePopover();
        }
      } catch {
        /* ignore */
      }
    }

    previewSheet.classList.remove("is-open");
    document.getElementById("preview-sheet-backdrop")?.classList.remove("is-open");
    document.body.classList.remove("overflow-hidden");
  }

  function initMobilePreview() {
    if (!previewFab || !previewSheet) return;

    previewFab.addEventListener("click", (event) => {
      event.preventDefault();
      openPreviewSheet();
    });

    const closeBtn = document.getElementById("preview-sheet-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        closePreviewSheet();
      });
    }

    const backdrop = document.getElementById("preview-sheet-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closePreviewSheet);
    }

    previewSheet.addEventListener("toggle", () => {
      if (!previewSheet.matches(":popover-open")) {
        document.body.classList.remove("overflow-hidden");
      }
    });

    if (mobilePreview) {
      mobilePreview.addEventListener("input", () => {
        mobilePreviewManuallyEdited = true;
        preview.value = mobilePreview.value;
        previewManuallyEdited = true;
        updateRefreshButton();
        updateCopyButton();
      });
    }

    if (mobileCopyBtn) {
      mobileCopyBtn.addEventListener("click", async () => {
        const text = (mobilePreview?.value || preview.value).trim();
        if (!text) return;

        try {
          await navigator.clipboard.writeText(text);
          showCopySuccess(mobileCopyBtn);
        } catch {
          mobilePreview?.select();
          document.execCommand("copy");
          showCopySuccess(mobileCopyBtn);
        }
      });
    }
  }

  async function copyPreviewText() {
    const text = preview.value.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showCopySuccess(copyBtn);
    } catch {
      preview.select();
      document.execCommand("copy");
      showCopySuccess(copyBtn);
    }
  }

  form.addEventListener("input", () => {
    updatePreviewFromFormIfAllowed();
    scheduleFormSave();
  });

  form.addEventListener("change", () => {
    syncAllChoiceButtons();
    updateConditionalSections();
    updatePreviewFromFormIfAllowed();
    scheduleFormSave();
  });

  preview.addEventListener("input", () => {
    previewManuallyEdited = true;
    if (!mobilePreviewManuallyEdited && mobilePreview) {
      mobilePreview.value = preview.value;
    }
    updateRefreshButton();
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
  });

  refreshBtn.addEventListener("click", syncPreviewFromForm);
  copyBtn.addEventListener("click", copyPreviewText);

  initTheme();
  initCallyDatePickers();
  initComboCardToggle();
  initChoiceButtons();
  initProjectCategory();
  initPendingDateToggles();
  initI956fStateToggles();
  initConditionalSections();
  initSofConditionalDetails();
  initOptionalRadioDeselect("i526Status");
  initOptionalRadioDeselect("womCounsel");
  initOptionalRadioDeselect("womStatus");
  initOptionalRadioDeselect("applicationLocation");
  initOptionalRadioDeselect("usedAgent");
  initOptionalRadioDeselect("keyUpdate");
  initKeyUpdateCelebration();
  initAutocompleteFields();
  initClearForm();
  initMobilePreview();
  initShareButtons();
  window.addEventListener("resize", updatePreviewPanelVisibility);
  loadFormState();
  updatePreviewPanelVisibility();
  updatePreviewStats();
  updateCopyButton();
})();
