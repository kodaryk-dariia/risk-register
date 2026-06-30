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

## Two simulation modes

- **Design** — no system exists yet; every control is a candidate, fully
  costed in every subset.
- **Baseline** — a system already exists. Controls marked "already
  implemented" are forced into every subset and their cost excluded from
  comparison (sunk cost), but their effectiveness still reduces risk.

## Author

Dariia Kosaryk — [linkedin.com/in/dariia-kosaryk-514841345](https://www.linkedin.com/in/dariia-kosaryk-514841345)
