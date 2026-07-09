(function () {
  "use strict";

  const form = document.getElementById("status-form");
  const preview = document.getElementById("preview");
  const copyBtn = document.getElementById("copy-btn");
  const copyFeedback = document.getElementById("copy-feedback");
  const refreshBtn = document.getElementById("refresh-preview");
  const comboCardToggle = document.getElementById("combo-card");

  let previewManuallyEdited = false;
  let comboCardValue = "";

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

  function getComboCardValue() {
    return comboCardValue;
  }

  function setComboCardValue(value) {
    comboCardValue = value;
    const options = comboCardToggle.querySelectorAll(".pill-toggle__option");

    options.forEach((option) => {
      const isSelected = option.dataset.value === value;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });

    comboCardToggle.classList.toggle("is-no", value === "No");
    comboCardToggle.classList.toggle("is-yes", value === "Yes");
  }

  function initComboCardToggle() {
    comboCardToggle.addEventListener("click", (event) => {
      const option = event.target.closest(".pill-toggle__option");
      if (!option) return;

      const nextValue = option.dataset.value;
      setComboCardValue(comboCardValue === nextValue ? "" : nextValue);
      updatePreviewFromFormIfAllowed();
    });
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
      ["SOF composition", getCheckedValues("sof").join(", ")],
      ["Attorney", getFieldValue("attorney")],
      ["Biometric notice", formatDate(getFieldValue("biometric-notice"))],
      ["EAD approved", formatDate(getFieldValue("ead-approval"))],
      ["AP approved", formatDate(getFieldValue("ap-approval"))],
      ["Combo card", getComboCardValue()],
      [null, buildI526Line(getFieldValue("i526-status"), getFieldValue("i526-date"))],
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
  form.addEventListener("change", updatePreviewFromFormIfAllowed);

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

  initComboCardToggle();
  updateCopyButton();
})();
