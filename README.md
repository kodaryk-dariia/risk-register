# Optimal Control Sets

A domain-agnostic Monte Carlo model for choosing security/safety controls
under a budget and a risk threshold. Includes a worked healthcare IoMT case
study as one example application.

## Pages

- `/` — concept & model: the pitch, the problem, the math, distribution
  justification, design-vs-baseline modes, data-sourcing guidance
- `/case-study/healthcare` — the original worked example: architecture,
  interfaces, STRIDE-by-element-type table, risk matrix, data provenance
- `/simulate` — the tool: New Design or Existing System (baseline) mode,
  manual entry or Excel upload, 3D cost/risk/RSI chart
- `/feedback` — low-key page linked only from the footer; a real contact
  form that emails feedback directly to you

## Feedback form setup (one-time, ~5 minutes, free)

The feedback form sends submissions to your Gmail using SMTP. No database,
no third-party service, no cost.

**Step 1 — Create a Gmail App Password** (you need this because Google blocks
plain password login for apps):

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (enable it if not already on)
3. Security → **App passwords** → select "Mail" + "Other (custom name)"
   → name it "Risk Register" → click Generate
4. Copy the 16-character password shown (you won't see it again)

**Step 2 — Add the credentials to Render** (never put passwords in code):

1. Go to your Render dashboard → your service → **Environment** tab
2. Add two environment variables:
   - `MAIL_USER` = `kosaryk.dasha@gmail.com`
   - `MAIL_PASS` = the 16-character App Password from Step 1
3. Click **Save Changes** — Render redeploys automatically

After that, every feedback form submission emails you at `kosaryk.dasha@gmail.com`.
Until you do this, the form still works but saves submissions to a temporary
log file instead (which is lost on redeploy — set up the credentials when
you can).

## Two simulation modes

- **Design** — no system exists yet; every control is a candidate, fully
  costed in every subset.
- **Baseline** — a system already exists. Controls marked "already
  implemented" are forced into every subset and their cost excluded from
  comparison (sunk cost), but their effectiveness still reduces risk.

## Local setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
# open http://localhost:5000
```

## Deploy to Render

1. Push to GitHub
2. Render → New → Web Service → connect repo
3. `render.yaml` / `.python-version` pin Python 3.11
4. Free tier → Deploy

## Project structure

```
├── app.py                          # Flask backend + simulation engine
├── requirements.txt
├── render.yaml / .python-version
├── templates/
│   ├── base.html                   # nav + author/feedback footer (all pages)
│   ├── index.html                  # concept & model (merged)
│   ├── case_study_healthcare.html  # worked example
│   ├── simulate.html               # the tool
│   └── feedback.html               # embedded Google Form
└── static/
    ├── css/main.css
    └── js/{main,simulation}.js     # 3D Plotly chart, mode switching, upload
```

## Spreadsheet upload

`/simulate` accepts an `.xlsx` with `Threats`, `Controls`, and `Mapping`
sheets. Download a blank template from the page, or via `GET /api/template`.

## Author

Dariia Kosaryk — [linkedin.com/in/dariia-kosaryk-514841345](https://www.linkedin.com/in/dariia-kosaryk-514841345)
