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
  const copyFeedback = document.getElementById("copy-feedback");
  const refreshBtn = document.getElementById("refresh-preview");
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

  const EXCLUSIVE_PROJECT_CATEGORIES = new Set(["Infra", "Direct"]);
  const CELEBRATION_EMOJI = "🎉";
  let comboCardValue = "";
  let previewManuallyEdited = false;

  function isPending(pendingId) {
    const el = document.getElementById(pendingId);
    return Boolean(el && el.checked);
  }

  function formatApprovalValue(inputId, pendingId) {
    if (isPending(pendingId)) return "Pending";
    const formatted = formatDate(getFieldValue(inputId));
    if (!formatted) return "";
    return `${formatted} ${CELEBRATION_EMOJI}`;
  }

  function withApprovedEmoji(status, text) {
    if (status === "Approved") return `${text} ${CELEBRATION_EMOJI}`;
    return text;
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

  function initCallyDatePickers() {
    DATE_FIELD_IDS.forEach((inputId) => {
      const input = document.getElementById(inputId);
      const calendar = document.querySelector(`calendar-date[data-input-id="${inputId}"]`);
      if (!input || !calendar) return;

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

  function setSelectedButtonStyle(el) {
    el.classList.remove("btn-soft");
    el.classList.add("btn-primary", "btn-active");
  }

  function setUnselectedButtonStyle(el) {
    el.classList.remove("btn-active");
    el.classList.add("btn-soft", "btn-primary");
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

  function hasI526DateContext() {
    return isPending("i526-date-pending") || Boolean(getFieldValue("i526-date"));
  }

  function hasWomDateContext() {
    return Boolean(getFieldValue("wom-date"));
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
    const show = hasI526DateContext();
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

  function updateConditionalSections() {
    updateI526StatusVisibility();
    updateWomDetailsVisibility();
    updateWomAttorneyVisibility();
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

  function buildI526Line(status, date, pending) {
    const formattedDate = formatDate(date);
    if (pending && !formattedDate) {
      if (status) return withApprovedEmoji(status, `I-526: ${status} (Pending)`);
      return "I-526: Pending";
    }
    if (!status && !formattedDate) return null;
    if (status && formattedDate) return withApprovedEmoji(status, `I-526: ${status} (${formattedDate})`);
    if (status) return withApprovedEmoji(status, `I-526: ${status}`);
    return `I-526 adjudication date: ${formattedDate}`;
  }

  function buildWomLine(forms, date) {
    if (!forms.length && !date) return null;
    const formattedDate = formatDate(date);
    if (forms.length && formattedDate) {
      return `WOM filed for ${forms.join(", ")} (${formattedDate})`;
    }
    if (forms.length) return `WOM filed for: ${forms.join(", ")}`;
    return `WOM filing date: ${formattedDate}`;
  }

  function generateMessage() {
    const bulletLines = [];

    const entries = [
      ["Priority date", formatDate(getFieldValue("priority-date"))],
      ["Project category", getProjectCategory()],
      ["Regional Center", getFieldValue("regional-center")],
      ["Project", getFieldValue("project-name")],
      ["SOF composition", getSofComposition()],
      ["Attorney", getFieldValue("attorney")],
      ["Application location", getRadioValue("applicationLocation")],
      ["Biometric notice", formatDate(getFieldValue("biometric-notice"))],
      ["EAD approved", formatApprovalValue("ead-approval", "ead-approval-pending")],
      ["AP approved", formatApprovalValue("ap-approval", "ap-approval-pending")],
      ["Combo card", getComboCardValue()],
      [
        null,
        hasI526DateContext()
          ? buildI526Line(
              getRadioValue("i526Status"),
              getFieldValue("i526-date"),
              isPending("i526-date-pending")
            )
          : null,
      ],
      [null, hasWomDateContext() ? buildWomLine(getCheckedValues("wom"), getFieldValue("wom-date")) : null],
      ["WOM counsel", hasWomDateContext() ? getWomCounselLine() : ""],
      ["WOM status", hasWomDateContext() ? getRadioValue("womStatus") : ""],
      ["WOM court", hasWomDateContext() ? getFieldValue("wom-court") : ""],
      ["I-485 approved", formatApprovalValue("i485-date", "i485-date-pending")],
    ];

    for (const [label, value] of entries) {
      if (!value) continue;
      bulletLines.push(label ? `${label}: ${value}` : value);
    }

    if (bulletLines.length === 0) return "";

    return [
      "EB-5 Status Update",
      "",
      ...bulletLines.map((line) => `• ${line}`),
      "",
      "Generated via bit.ly/eb5status",
    ].join("\n");
  }

  function updatePreviewFromFormIfAllowed() {
    if (!previewManuallyEdited) {
      preview.value = generateMessage();
    }
    updateCopyButton();
  }

  function syncPreviewFromForm() {
    preview.value = generateMessage();
    previewManuallyEdited = false;
    updateRefreshButton();
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
    updateCopyButton();
  });

  refreshBtn.addEventListener("click", syncPreviewFromForm);

  copyBtn.addEventListener("click", async () => {
    const text = preview.value.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copyFeedback.textContent = "Copied!";
    } catch {
      preview.select();
      document.execCommand("copy");
      copyFeedback.textContent = "Copied!";
    }

    setTimeout(() => {
      copyFeedback.textContent = "";
    }, 2500);
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
  updateCopyButton();
})();
