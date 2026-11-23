# MyCost Tracker starter issue suggestions

These are proposed, unfiled issues for contributors. They are not existing GitHub issues. Confirm the current code and upstream dataset behavior before opening one; do not add made-up data or screenshots.

## 1. Add accessible text summaries for dashboard charts

**Suggested labels:** `good first issue`, `accessibility`, `help wanted`

**Scope:** Provide keyboard- and screen-reader-friendly summaries or data tables corresponding to the CPI, state, and fuel charts.

**Acceptance criteria:**
- Each chart has a concise accessible label and an equivalent way to inspect the plotted values without relying on color.
- Keyboard users can reach and understand the summaries.
- No chart labels or values are fabricated.

## 2. Add focused explorer filter tests

**Suggested labels:** `good first issue`, `tests`

**Scope:** Cover the dataset explorer's local keyword filtering and CSV export edge cases.

**Acceptance criteria:**
- Tests cover case-insensitive matches, empty queries, and values containing commas, quotes, and newlines in exported CSV.
- Existing explorer behavior remains unchanged outside the tested cases.
- `npm test` passes.

## 3. Add API timeout and stale-fallback tests

**Suggested labels:** `help wanted`, `tests`

**Scope:** Test retry exhaustion and the documented in-process fallback behavior using mocked fetches.

**Acceptance criteria:**
- Tests cover a transient failure followed by success, a terminal failure without cached data, and stale fallback after a previous success.
- Tests do not call the live data.gov.my API.
- Expected stale/error states are asserted without depending on wall-clock timing.

## 4. Document chart units and dataset field mapping in the explorer

**Suggested labels:** `good first issue`, `documentation`, `help wanted`

**Scope:** Make the selected dataset's units and source fields easier to understand.

**Acceptance criteria:**
- CPI index values are distinguished from currency amounts.
- Fuel prices identify currency per litre and distinguish relevant subsidy/coverage fields.
- The UI links to the corresponding official dataset documentation.

## 5. Add a reproducible notebook environment file

**Suggested labels:** `good first issue`, `notebooks`

**Scope:** Pin or constrain the Python libraries needed to run both notebooks.

**Acceptance criteria:**
- A documented environment installs pandas, requests, and matplotlib.
- Both notebooks execute against live public endpoints without embedded output.
- No API token or private credential is required.

## 6. Improve mobile chart exploration

**Suggested labels:** `help wanted`, `accessibility`, `ui`

**Scope:** Improve chart readability and control layout at narrow viewport widths.

**Acceptance criteria:**
- The dashboard can be used at a 375 CSS-pixel viewport without horizontal page overflow.
- Controls remain keyboard operable and chart labels remain readable.
- A real before/after screenshot is attached when the work is proposed.

## 7. Add explicit metadata freshness display tests

**Suggested labels:** `good first issue`, `tests`

**Scope:** Test how release dates, refresh frequency, and stale status are presented.

**Acceptance criteria:**
- Tests cover metadata present, metadata omitted by the upstream API, and stale response presentation.
- Missing metadata is not replaced with invented dates.
- Existing error UI remains explicit.

## 8. Add an export-format explanation to the explorer

**Suggested labels:** `good first issue`, `documentation`

**Scope:** Explain that CSV export includes only the currently visible, locally filtered rows.

**Acceptance criteria:**
- The UI states the selected dataset and that filtering is local to the returned records.
- Exported headers match the displayed dataset fields.
- No claim is made that the explorer contains the full upstream dataset when it is capped.

## Publication status

The repository currently has no MyCost Tracker starter issues filed. The suggested repository topics are `malaysia`, `open-data`, `nextjs`, `typescript`, `dashboard`, and `data-visualization`; they have not been applied to GitHub.
