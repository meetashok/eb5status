# EB-5 Status Update Draft

A simple, mobile-friendly web app for EB-5 investor community members to draft structured status updates and paste them into WhatsApp groups.

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
- Mobile responsive layout with side-by-side live preview on desktop
- Native form controls for fast mobile date entry (OS date picker on phone)
- Chip multi-select for SOF and WOM filing
- Animated Yes/No pill toggle for combo card
- Segmented control for WOM counsel

## Fields

| Field | Type |
|-------|------|
| Priority date | Date |
| Regional Center | Text |
| Project name | Text |
| SOF composition | Multi-select |
| Attorney | Text |
| Biometric notice | Date |
| EAD approval date | Date |
| AP approval date | Date |
| Combo card | Yes / No |
| I-526 adjudication | Status (Approved, RFE, NOID, Denied) + date |
| WOM filing | Multi-select (I-526, I-485, EAD, AP) + date |
| WOM counsel | Attorney / Pro se |
| I-485 adjudication date | Date |
