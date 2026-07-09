(function () {
  "use strict";

  const form = document.getElementById("status-form");
  const preview = document.getElementById("preview");
  const copyBtn = document.getElementById("copy-btn");
  const copyFeedback = document.getElementById("copy-feedback");
  const refreshBtn = document.getElementById("refresh-preview");

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

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(
      (el) => el.value
    );
  }

  function getRadioValue(name) {
    const selected = form.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function getFieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function hasAnyFormData() {
    const textInputs = form.querySelectorAll('input[type="text"], input[type="date"], select');
    for (const input of textInputs) {
      if (input.value.trim()) return true;
    }
    if (form.querySelector('input[type="checkbox"]:checked')) return true;
    if (form.querySelector('input[type="radio"]:checked')) return true;
    return false;
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
      [
        "SOF composition",
        getCheckedValues("sof").join(", "),
      ],
      ["Attorney", getFieldValue("attorney")],
      ["Biometric notice", formatDate(getFieldValue("biometric-notice"))],
      ["EAD approved", formatDate(getFieldValue("ead-approval"))],
      ["AP approved", formatDate(getFieldValue("ap-approval"))],
      ["Combo card", getRadioValue("comboCard")],
      [
        null,
        buildI526Line(getFieldValue("i526-status"), getFieldValue("i526-date")),
      ],
      [
        null,
        buildWomLine(getCheckedValues("wom"), getFieldValue("wom-date")),
      ],
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

  function syncPreviewFromForm() {
    preview.value = generateMessage();
    previewManuallyEdited = false;
    updateRefreshButton();
    updateCopyButton();
  }

  form.addEventListener("input", () => {
    if (!previewManuallyEdited) {
      preview.value = generateMessage();
    }
    updateCopyButton();
  });

  form.addEventListener("change", () => {
    if (!previewManuallyEdited) {
      preview.value = generateMessage();
    }
    updateCopyButton();
  });

  preview.addEventListener("input", () => {
    previewManuallyEdited = true;
    updateRefreshButton();
    updateCopyButton();
  });

  refreshBtn.addEventListener("click", () => {
    syncPreviewFromForm();
  });

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

  updateCopyButton();
})();
