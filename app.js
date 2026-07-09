(function () {
  "use strict";

  const THEME_KEY = "eb5-theme";
  const DATE_WRAP_IDS = [
    "priority-date-wrap",
    "biometric-notice-wrap",
    "ead-approval-wrap",
    "ap-approval-wrap",
    "i526-date-wrap",
    "wom-date-wrap",
    "i485-date-wrap",
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

  let comboCardValue = "";
  const flatpickrInstances = [];

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

  function getThemeColors() {
    const probe = document.createElement("div");
    probe.className = "bg-base-100 text-base-content border-base-300";
    probe.style.cssText = "position:absolute;left:-9999px;";
    document.body.appendChild(probe);
    const styles = getComputedStyle(probe);
    const colors = {
      background: styles.backgroundColor,
      color: styles.color,
      border: styles.borderColor,
    };
    document.body.removeChild(probe);
    return colors;
  }

  function syncFlatpickrTheme() {
    const colors = getThemeColors();
    document.querySelectorAll(".flatpickr-calendar").forEach((calendar) => {
      calendar.style.background = colors.background;
      calendar.style.color = colors.color;
      calendar.style.borderColor = colors.border;
    });
    document.querySelectorAll(".flatpickr-day").forEach((day) => {
      day.style.color = colors.color;
    });
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    themeToggle.checked = saved === "light";

    themeToggle.addEventListener("change", () => {
      const next = themeToggle.checked ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
      syncFlatpickrTheme();
    });
  }

  function initDatePickers() {
    const colors = getThemeColors();

    DATE_WRAP_IDS.forEach((wrapId) => {
      const instance = flatpickr(`#${wrapId}`, {
        wrap: true,
        dateFormat: "Y-m-d",
        disableMobile: true,
        position: "auto left",
        clickOpens: true,
        allowInput: false,
        onReady: (_dates, _str, fp) => {
          fp.calendarContainer.style.background = colors.background;
          fp.calendarContainer.style.color = colors.color;
          fp.calendarContainer.style.borderColor = colors.border;
        },
        onOpen: syncFlatpickrTheme,
        onChange: updatePreviewFromFormIfAllowed,
      });
      flatpickrInstances.push(instance);
    });
  }

  function getComboCardValue() {
    return comboCardValue;
  }

  function setComboCardValue(value) {
    comboCardValue = value;
    comboCardToggle.querySelectorAll("[data-value]").forEach((option) => {
      const isSelected = option.dataset.value === value;
      option.classList.toggle("btn-primary", isSelected);
      option.classList.toggle("btn-ghost", !isSelected);
      option.classList.toggle("bg-base-200/40", !isSelected);
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
    label.classList.toggle("btn-primary", input.checked);
    label.classList.toggle("btn-ghost", !input.checked);
    label.classList.toggle("bg-base-200/40", !input.checked);
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
    const lines = ["EB-5 Status Update", ""];

    const entries = [
      ["Priority date", formatDate(getFieldValue("priority-date"))],
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
      lines.push(label ? `${label}: ${value}` : value);
    }

    if (lines.length === 2) return "";
    return lines.join("\n");
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
  initDatePickers();
  initComboCardToggle();
  initChoiceButtons();
  initSofConditionalDetails();
  initOptionalRadioDeselect("i526Status");
  initOptionalRadioDeselect("womCounsel");
  updateCopyButton();
})();
