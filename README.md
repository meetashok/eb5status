# EB-5 Status Update Draft

A mobile-friendly web app for EB-5 investor community members to draft structured status updates and paste them into WhatsApp groups.

## Live demo

Enable GitHub Pages on this repository (Settings → Pages → Deploy from branch `main`, folder `/ (root)`). The app will be available at:

`https://<your-username>.github.io/eb5status/`

## Local preview

Open `index.html` in a browser, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Features

- Structured fields for common EB-5 milestones (priority date, regional center, project, SOF, attorney, biometrics, EAD/AP, I-526/I-485 adjudication, WOM, etc.)
- Live message preview that updates as you fill the form
- Direct editing of the preview text before copying
- One-click copy to clipboard
- All fields optional — copy is enabled when at least one field has content
- **Tailwind CSS + DaisyUI** components via CDN (no build step)
- **Dark/light theme toggle** (default dark), preference saved in `localStorage`
- **Cally** calendar date fields (DaisyUI) with calendar icon on the left — type or pick
- Chip multi-select for SOF; equal-width pills for WOM filing
- Segmented option picker for I-526 adjudication status
- Side-by-side live preview on desktop

## Stack

- [Tailwind CSS](https://tailwindcss.com/) (browser CDN)
- [DaisyUI](https://daisyui.com/) (CDN)
- [Cally](https://wicky.nillia.ms/cally/) (CDN web component, styled via DaisyUI `cally` class)
- Vanilla JavaScript — no build step, GitHub Pages ready

## Fields

| Field | Type |
|-------|------|
| Priority date | Date (Cally calendar) |
| Regional Center | Text |
| Project name | Text |
| SOF composition | Multi-select chips |
| Attorney | Text |
| Biometric notice | Date (Cally calendar) |
| EAD approval date | Date (Cally calendar) |
| AP approval date | Date (Cally calendar) |
| Combo card | Yes / No |
| I-526 adjudication | Option picker (Approved, RFE, NOID, Denied) + date |
| WOM filing | Multi-select pills (I-526, I-485, EAD, AP) + date |
| WOM counsel | Attorney / Pro se |
| I-485 adjudication date | Date (Cally calendar) |
