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
  let comboCardValue = "";
  let previewManuallyEdited = false;

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
          updatePreviewFromFormIfAllowed();
        }
        if (popover && typeof popover.hidePopover === "function") {
          popover.hidePopover();
        }
      });

      input.addEventListener("input", () => {
        syncCalendarFromInput(input, calendar);
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

  function buildI526Line(status, date) {
    if (!status && !date) return null;
    const formattedDate = formatDate(date);
    if (status && formattedDate) return `I-526: ${status} (${formattedDate})`;
    if (status) return `I-526: ${status}`;
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
      ["Biometric notice", formatDate(getFieldValue("biometric-notice"))],
      ["EAD approved", formatDate(getFieldValue("ead-approval"))],
      ["AP approved", formatDate(getFieldValue("ap-approval"))],
      ["Combo card", getComboCardValue()],
      [null, buildI526Line(getRadioValue("i526Status"), getFieldValue("i526-date"))],
      [null, buildWomLine(getCheckedValues("wom"), getFieldValue("wom-date"))],
      ["WOM counsel", getRadioValue("womCounsel")],
      ["I-485 approved", formatDate(getFieldValue("i485-date"))],
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
  initSofConditionalDetails();
  initOptionalRadioDeselect("i526Status");
  initOptionalRadioDeselect("womCounsel");
  updateCopyButton();
})();
