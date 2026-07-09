(function () {
  "use strict";

  const THEME_KEY = "eb5-theme";
  const DATE_FIELD_IDS = [
    "priority-date",
    "biometric-notice",
    "ead-approval",
    "ap-approval",
    "i526-date",
    "wom-date",
    "i485-date",
  ];

  const form = document.getElementById("status-form");
  const preview = document.getElementById("preview");
  const copyBtn = document.getElementById("copy-btn");
  const refreshBtn = document.getElementById("refresh-preview");
  const previewPanel = document.getElementById("preview-panel");
  const celebrationToast = document.getElementById("celebration-toast");
  const celebrationToastText = document.getElementById("celebration-toast-text");
  const copyToast = document.getElementById("copy-toast");
  const statKeyUpdate = document.getElementById("stat-key-update");
  const statDaysPd = document.getElementById("stat-days-pd");
  const statFieldsFilled = document.getElementById("stat-fields-filled");
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
  const EXCLUSIVE_PROJECT_CATEGORIES = new Set(["Infra", "Direct"]);
  const BTN_COLOR_NAMES = ["primary", "secondary", "accent", "info", "success", "warning", "error", "neutral"];

  let comboCardValue = "";
  let previewManuallyEdited = false;
  let celebrationToastTimer = null;
  let copyToastTimer = null;
  let lastCelebratedKeyUpdate = "";

  function isPending(pendingId) {
    const el = document.getElementById(pendingId);
    return Boolean(el && el.checked);
  }

  function formatDateWithPdOffset(isoDate) {
    const formatted = formatDate(isoDate);
    if (!formatted) return "";
    const offset = daysFromPriorityDate(isoDate);
    return offset ? `${formatted} (${offset})` : formatted;
  }

  function daysAfterPriorityDate(isoDate) {
    const priorityDate = parseIsoDate(getFieldValue("priority-date"));
    const eventDate = parseIsoDate(isoDate);
    if (!priorityDate || !eventDate) return "";

    const toLocalDate = (iso) => {
      const [year, month, day] = iso.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    const diffDays = Math.round(
      (toLocalDate(eventDate).getTime() - toLocalDate(priorityDate).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    const sign = diffDays >= 0 ? "+" : "";
    return `${sign}${diffDays} days after PD`;
  }

  function getKeyUpdateReferenceDate(keyUpdate) {
    switch (keyUpdate) {
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

  function buildTitleLine() {
    const keyUpdate = getRadioValue("keyUpdate");
    if (!keyUpdate) return "EB5 Status Update";

    const title = KEY_UPDATE_TITLES[keyUpdate];
    if (!title) return "EB5 Status Update";

    const referenceDate = getKeyUpdateReferenceDate(keyUpdate);
    const daysAfter = referenceDate ? daysAfterPriorityDate(referenceDate) : "";
    return daysAfter
      ? `EB5 Status Update: ${title} (${daysAfter})`
      : `EB5 Status Update: ${title}`;
  }

  function daysFromPriorityDate(isoDate) {
    const priorityDate = parseIsoDate(getFieldValue("priority-date"));
    const eventDate = parseIsoDate(isoDate);
    if (!priorityDate || !eventDate) return "";

    const toLocalDate = (iso) => {
      const [year, month, day] = iso.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    const diffDays = Math.round(
      (toLocalDate(eventDate).getTime() - toLocalDate(priorityDate).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    const sign = diffDays >= 0 ? "+" : "";
    return `${sign}${diffDays} days from PD`;
  }

  function formatPendingDateValue(inputId, pendingId) {
    if (isPending(pendingId)) return "Pending";
    return formatDateWithPdOffset(getFieldValue(inputId));
  }

  function formatApprovalValue(inputId, pendingId) {
    const formatted = formatPendingDateValue(inputId, pendingId);
    if (!formatted || formatted === "Pending") return formatted;
    return `${formatted} ${CELEBRATION_EMOJI}`;
  }

  function formatDate(isoDate) {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  function showCopyToast() {
    if (!copyToast) return;

    copyToast.classList.add("is-visible");
    copyToast.setAttribute("aria-hidden", "false");

    if (copyToastTimer) clearTimeout(copyToastTimer);
    copyToastTimer = setTimeout(() => {
      copyToast.classList.remove("is-visible");
      copyToast.setAttribute("aria-hidden", "true");
    }, 2500);

    copyBtn.classList.add("btn-success");
    copyBtn.classList.remove("btn-primary");
    setTimeout(() => {
      copyBtn.classList.remove("btn-success");
      copyBtn.classList.add("btn-primary");
    }, 1000);
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

  function updatePreviewStats() {
    const keyUpdate = getRadioValue("keyUpdate");

    if (statKeyUpdate) {
      statKeyUpdate.textContent = keyUpdate ? KEY_UPDATE_TITLES[keyUpdate] || "—" : "—";
    }

    if (statDaysPd) {
      const referenceDate = keyUpdate ? getKeyUpdateReferenceDate(keyUpdate) : "";
      const days =
        referenceDate && parseIsoDate(getFieldValue("priority-date"))
          ? daysFromPriorityDate(referenceDate)
          : "";
      statDaysPd.textContent = days || "—";
    }

    if (statFieldsFilled) {
      statFieldsFilled.textContent = String(countFilledFields());
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

  function filterSuggestions(suggestions, query, limit = 8) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suggestions.slice(0, limit);

    return suggestions
      .filter((item) => item.toLowerCase().includes(normalized))
      .slice(0, limit);
  }

  function initAutocomplete(inputId, listId, suggestions) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list || !suggestions.length) return;

    let activeIndex = -1;
    let hideTimer = null;

    function hideSuggestions() {
      list.classList.add("hidden");
      list.innerHTML = "";
      activeIndex = -1;
    }

    function selectSuggestion(value) {
      input.value = value;
      hideSuggestions();
      updatePreviewFromFormIfAllowed();
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
    }

    function updateSuggestions() {
      renderSuggestions(filterSuggestions(suggestions, input.value));
    }

    input.addEventListener("input", updateSuggestions);
    input.addEventListener("focus", updateSuggestions);
    input.addEventListener("blur", () => {
      hideTimer = setTimeout(hideSuggestions, 150);
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
      });
    });

    list.addEventListener("mousedown", () => {
      if (hideTimer) clearTimeout(hideTimer);
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
        }
        if (popover && typeof popover.hidePopover === "function") {
          popover.hidePopover();
        }
      });

      input.addEventListener("input", () => {
        syncCalendarFromInput(input, calendar);
        updateConditionalSections();
        updatePreviewFromFormIfAllowed();
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
    });
  }

  function syncChoiceButton(input) {
    const label = input.closest("label.choice-btn");
    if (!label) return;
    if (input.checked) {
      setSelectedButtonStyle(label);
    } else {
      setUnselectedButtonStyle(label);
    }
  }

  function syncRadioGroup(groupName) {
    form.querySelectorAll(`input[name="${groupName}"]`).forEach((radio) => {
      syncChoiceButton(radio);
    });
  }

  function syncAllChoiceButtons() {
    form.querySelectorAll('label.choice-btn input[type="checkbox"]').forEach(syncChoiceButton);
    syncRadioGroup("i526Status");
    syncRadioGroup("womCounsel");
    syncRadioGroup("womStatus");
    syncRadioGroup("applicationLocation");
    syncRadioGroup("keyUpdate");
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
        if (!checkbox.checked) {
          syncChoiceButton(checkbox);
          updatePreviewFromFormIfAllowed();
          return;
        }

        if (EXCLUSIVE_PROJECT_CATEGORIES.has(checkbox.value)) {
          form.querySelectorAll('input[name="projectCategory"]').forEach((other) => {
            if (other !== checkbox) other.checked = false;
          });
        } else {
          form.querySelectorAll('input[name="projectCategory"]').forEach((other) => {
            if (EXCLUSIVE_PROJECT_CATEGORIES.has(other.value)) other.checked = false;
          });
        }

        form.querySelectorAll('input[name="projectCategory"]').forEach(syncChoiceButton);
        updatePreviewFromFormIfAllowed();
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
    return formatDateWithPdOffset(getFieldValue("wom-date"));
  }

  function getWomFiledForValue() {
    return getCheckedValues("wom").join(", ");
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
    if (attorneyInput) attorneyInput.value = "";
    if (courtInput) courtInput.value = "";
    syncAllChoiceButtons();
  }

  function updateI526StatusVisibility() {
    const wrap = document.getElementById("i526-status-wrap");
    if (!wrap) return;
    const show = hasI526StatusContext();
    wrap.classList.toggle("hidden", !show);
    if (show) ensureDefaultI526Approved();
  }

  function updateWomDetailsVisibility() {
    const wrap = document.getElementById("wom-details-wrap");
    if (!wrap) return;
    const show = hasWomDateContext();
    wrap.classList.toggle("hidden", !show);
    if (!show) clearWomDetails();
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
    copyBtn.disabled = !hasPreviewContent();
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

    const formattedDate = formatDateWithPdOffset(date);
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

    const entries = [
      ["Priority date", formatDate(getFieldValue("priority-date"))],
      ["Project category", getProjectCategory()],
      ["Regional Center", getFieldValue("regional-center")],
      ["Project", getFieldValue("project-name")],
      ["Attorney", getFieldValue("attorney")],
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
      ["WOM filed on", hasWomPreviewContext() ? getWomFiledOnValue() : ""],
      ["WOM filed for", hasWomDateContext() ? getWomFiledForValue() : ""],
      ["WOM counsel", hasWomDateContext() ? getWomCounselLine() : ""],
      ["WOM court", hasWomDateContext() ? getFieldValue("wom-court") : ""],
      ["WOM status", hasWomDateContext() ? getRadioValue("womStatus") : ""],
      ["I-485 approved", formatApprovalValue("i485-date", "i485-date-pending")],
      ["SOF composition", getSofComposition()],
    ];

    for (const [label, value] of entries) {
      if (!value) continue;
      bulletLines.push(label ? `${label}: ${value}` : value);
    }

    if (!getRadioValue("keyUpdate") || bulletLines.length === 0) return "";

    return [
      buildTitleLine(),
      "",
      ...bulletLines.map((line) => `• ${line}`),
      "",
      "Generated via bit.ly/eb5status",
    ].join("\n");
  }

  function shouldShowPreviewPanel() {
    if (previewManuallyEdited && preview.value.trim()) return true;
    return Boolean(generateMessage());
  }

  function updatePreviewPanelVisibility() {
    if (!previewPanel) return;
    const shouldShow = shouldShowPreviewPanel();
    const wasHidden = previewPanel.classList.contains("hidden");
    previewPanel.classList.toggle("hidden", !shouldShow);
    if (shouldShow && wasHidden) {
      previewPanel.classList.add("preview-panel-enter");
      previewPanel.addEventListener(
        "animationend",
        () => {
          previewPanel.classList.remove("preview-panel-enter");
        },
        { once: true }
      );
    }
  }

  function updatePreviewFromFormIfAllowed() {
    if (!previewManuallyEdited) {
      preview.value = generateMessage();
    }
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
  }

  function syncPreviewFromForm() {
    preview.value = generateMessage();
    previewManuallyEdited = false;
    updateRefreshButton();
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
  }

  form.addEventListener("input", updatePreviewFromFormIfAllowed);
  form.addEventListener("change", () => {
    syncAllChoiceButtons();
    updateConditionalSections();
    updatePreviewFromFormIfAllowed();
  });

  preview.addEventListener("input", () => {
    previewManuallyEdited = true;
    updateRefreshButton();
    updatePreviewPanelVisibility();
    updatePreviewStats();
    updateCopyButton();
  });

  refreshBtn.addEventListener("click", syncPreviewFromForm);

  copyBtn.addEventListener("click", async () => {
    const text = preview.value.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showCopyToast();
    } catch {
      preview.select();
      document.execCommand("copy");
      showCopyToast();
    }
  });

  initTheme();
  initCallyDatePickers();
  initComboCardToggle();
  initChoiceButtons();
  initProjectCategory();
  initPendingDateToggles();
  initConditionalSections();
  initSofConditionalDetails();
  initOptionalRadioDeselect("i526Status");
  initOptionalRadioDeselect("womCounsel");
  initOptionalRadioDeselect("womStatus");
  initOptionalRadioDeselect("applicationLocation");
  initOptionalRadioDeselect("keyUpdate");
  initKeyUpdateCelebration();
  initAutocompleteFields();
  updatePreviewPanelVisibility();
  updatePreviewStats();
  updateCopyButton();
})();
