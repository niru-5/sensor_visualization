# Camera & Lens Selection Tool — Requirements

## 1. Problem statement

Selecting a camera sensor and lens for a machine vision / imaging application
today means digging through PDF datasheets from multiple vendors and doing
the same optical math by hand for every candidate combination. It's hard to
build intuition for how sensor size, pixel size, focal length, and working
distance relate to each other, and easy to pick a lens/sensor pair that
doesn't actually fit the application (wrong field of view, vignetting,
incompatible mount, insufficient resolution).

This tool should let someone paste in or select the numbers from a
datasheet and immediately *see* the consequences: how sensors compare in
size, what field of view a lens/sensor combo produces at a given working
distance, whether the lens's image circle actually covers the sensor, and
how resolution/pixel pitch compares across candidates.

## 2. Target user & primary use case

- **User**: someone specifying or evaluating a machine-vision or embedded
  vision system (engineer, hobbyist, integrator) — not a consumer picking a
  photography camera.
- **Primary job to be done**: "I have 2–4 candidate sensors and lenses. Help
  me compare them visually and check whether each combination is actually
  viable for my application (required FOV, working distance, mount)."
- Domain vocabulary is industrial/machine-vision (C/CS/S-mount, working
  distance, image circle, pixel pitch, line pairs/mm), not consumer
  photography terms (crop factor, bokeh, ISO).

## 3. Scope (v1 / MVP)

### 3.1 Data entry
- Primary entry path: user pastes one or two datasheet links (PDF or
  vendor spec page) and the tool fetches and extracts the relevant
  sensor/lens fields automatically, presenting them as an editable,
  pre-filled form for the user to review and confirm before saving —
  extracted data is never saved silently without a confirm step.
- If extraction fails or a field can't be found, that field is left
  blank and clearly flagged rather than guessed, so the user knows what
  to fill in manually.
- Manual entry remains available as a fallback/direct-edit path (typing
  values in, or fixing fields the extractor got wrong).
- Ship v1 with a small hand-curated seed dataset of common industrial
  sensors (e.g. popular Sony IMX / ON Semi models) and lenses, so the
  tool isn't empty on first use.
- Save entered/imported sensors/lenses locally (in-browser) so they can
  be reused across sessions and combined into comparisons.
- Support entering multiple sensors and multiple lenses, then pick any
  combination — including multiple lenses against a single sensor — to
  analyze together.

### 3.2 Sensor size comparison
- Draw sensors to scale on a shared grid so relative size is visually
  obvious (width × height rectangles, correct aspect ratio, diagonal
  labeled).
- Support both explicit sensor dimensions (mm) and the legacy "optical
  format" notation (e.g. 1/2.5", 1/1.8", 1", 4/3") via a lookup table,
  since most machine-vision datasheets quote optical format rather than
  literal mm dimensions.
- Overlay multiple sensors on the same scale for direct comparison.

### 3.3 Field of view (FOV) calculator
- Given sensor width/height (mm), lens focal length (mm), and working
  distance, compute and visualize horizontal and vertical FOV.
- Use the standard thin-lens relation rather than the far-field
  approximation, since machine-vision working distances are often close
  enough that the approximation matters:
  - magnification `m = f / (WD − f)`
  - `FOV = sensor_dimension / m = sensor_dimension × (WD − f) / f`
  - Note in the UI when WD is close enough to f that results are
    sensitive/approximate.
- Visualize FOV as a 3D camera-cone diagram (camera position, frustum,
  sensor plane, and the resulting footprint rectangle at the working
  distance) rather than a flat 2D-only footprint — with orbit/zoom
  controls so the geometry is easy to read, not just accurate.
- Allow solving for any one variable given the other three (e.g. "what
  focal length do I need for this FOV at this working distance").
- Near physically sensitive or invalid inputs (e.g. working distance
  approaching or at/below the focal length, where the thin-lens formula
  blows up or is undefined), don't hard-block the user — render the
  cone/footprint with a visual uncertainty cue (fading opacity, dashed
  edges, or a widening error band that scales with how sensitive the
  result is) plus a plain-language warning near the numbers.

### 3.4 Lens–sensor compatibility check
- Compare lens image circle diameter against sensor diagonal; flag
  vignetting risk if image circle < sensor diagonal (with some margin).
- Compare lens mount type against sensor/camera mount type (C, CS, S-mount
  / M12, others as needed) and flag mismatches, including the C/CS
  5 mm flange-distance spacer case.
- Surface a clear pass/fail/warning per candidate pairing, not just raw
  numbers.

### 3.5 Resolution & pixel pitch comparison
- Compare sensor resolution (H×V pixels, megapixels), pixel pitch (µm),
  and sensor active area across candidates.
- Derive and display spatial resolution at the working distance, e.g.
  ground-resolution per pixel (mm/pixel) = FOV width ÷ horizontal pixel
  count, so users can check whether resolution is sufficient for their
  smallest feature of interest.
- Optionally show the pixel-limited Nyquist resolution (line pairs/mm =
  1 / (2 × pixel pitch)) alongside the lens's rated resolving power if the
  user enters it, so they can see which one is the limiting factor.

### 3.6 Comparison view
- Support one sensor compared against multiple candidate lenses at once
  (not just a single pairwise comparison), since that's the more common
  real workflow: "I've picked a sensor, which of these lenses fits best?"
- A side-by-side table/dashboard for the currently selected sensor +
  lens candidates showing: sensor size, resolution, pixel pitch, focal
  length, computed FOV, compatibility flags, and derived spatial
  resolution — the single view that answers "which of these should I
  pick."

## 4. Data model (draft)

**Sensor**
- name / model
- optical format (e.g. "1/1.8\"") — optional, used only to derive mm
  dimensions via lookup if explicit mm not given
- active area width, height (mm)
- resolution: horizontal × vertical pixels
- pixel pitch (µm) — derivable from active area ÷ resolution if not given
  directly
- mount type (C, CS, S-mount/M12, other)
- source: `seed` | `manual` | `datasheet-import`
- sourceUrl — the datasheet link, when imported (kept for provenance;
  not re-fetched automatically after the initial import)

**Lens**
- name / model
- focal length (mm) — or min/max for zoom
- mount type (C, CS, S-mount/M12, other)
- image circle diameter (mm)
- max aperture (f/#) — optional, not core to v1 calculations
- rated resolving power (line pairs/mm) — optional
- source: `seed` | `manual` | `datasheet-import`
- sourceUrl — the datasheet link, when imported

**Sensor+Lens pairing (derived, not stored)**
- working distance (mm) — user input per analysis
- computed: magnification, horizontal FOV, vertical FOV, mm/pixel,
  compatibility flags

## 5. Non-functional requirements

- **Platform**: web app. Core UI, calculations, visualization, and
  persistence run client-side. Datasheet-link extraction needs a thin
  backend (a single serverless function is enough) to fetch the URL
  server-side and call an extraction model — the browser can't reliably
  fetch arbitrary third-party PDFs (CORS) or hold an API key securely.
  This backend is stateless: it extracts and returns data, it doesn't
  store anything.
- **No account/login required** for v1 — data persistence is local to the
  browser (e.g. localStorage), with an explicit warning that clearing
  browser data loses saved entries.
- **Export/import**: ability to export entered sensor/lens data (e.g. JSON)
  and re-import, so users don't lose work and can share a comparison set.
- Visualizations should be clear at a glance — this is explicitly a "stop
  reading numbers, start seeing the difference" tool, so diagrams take
  priority over dense tables.
- Should work reasonably on both desktop and tablet-width screens; mobile
  phone support is not a priority for v1.

## 6. Explicitly out of scope (v1)

- Bulk crawling or scraping entire vendor catalogs — v1 only fetches a
  single datasheet link the user explicitly provides, not automated
  discovery of specs.
- Live API lookups against vendor/manufacturer databases.
- OCR of scanned/image-only PDFs, or datasheets behind login walls —
  extraction targets normal text-based PDFs and public spec pages.
- Expanding the seed dataset beyond a small hand-picked starter set for
  v1 (a handful of common sensors/lenses, not a comprehensive catalog).
- Depth-of-field, bokeh, and other consumer-photography-oriented optics.
- Multi-user collaboration / shared cloud storage of comparisons.
- Price/availability data or purchase links.
- Advanced lens aberration modeling (distortion, MTF curves beyond a
  single rated resolving-power number).

## 7. Decisions from scoping review

- Ship v1 with a small hand-curated seed dataset of common sensors/lenses
  so the tool isn't empty on first use.
- Support multiple lenses against a single sensor in the comparison view,
  not just pairwise comparisons.
- FOV visualization is a 3D camera-cone style view, not a flat 2D-only
  diagram.
- Don't hard-block physically sensitive/invalid inputs — surface
  uncertainty visually (fading/dashed rendering, widening error band)
  instead of a validation error.

## 8. Open questions

1. Extraction quality: which fields are "must extract" vs "nice to have"
   per datasheet, and what's the fallback UX when extraction confidence
   is low for a field (blank + flag, vs. best-guess + flag)?
2. Seed dataset: which specific vendors/models to include for v1 — needs
   a short curated list, not an open-ended catalog.
3. Uncertainty encoding: exact visual language for "this result is
   sensitive/invalid" (color gradient vs. numeric confidence badge vs.
   both) needs a quick design pass once the 3D view exists to test it in.
4. Caching: should extraction results be cached by URL (client-side, or
   in the backend function) to avoid re-fetching/re-calling the model
   every time the same datasheet link is used?

## 9. Success criteria

- A user can enter 2+ sensors and 2+ lenses from real datasheets and,
  within a few minutes, get a clear visual answer to "which combination
  gives me the field of view and resolution I need, and does the lens
  actually fit the sensor."
- Sensor size comparisons are visually correct to scale (verifiable by
  spot-checking against known sensor dimensions, e.g. a 1" sensor is
  visibly larger than a 1/2.5" sensor in the right proportion).
- FOV calculator results match hand-calculated values using the correct
  thin-lens formula (not the far-field approximation) for a handful of
  reference cases — covered by unit tests against known values, not just
  eyeballed in the UI.
- Given a real datasheet URL for a common sensor/lens, the extraction
  flow correctly pre-fills the core required fields (sensor: active
  area/resolution/pixel pitch/mount; lens: focal length/mount/image
  circle) for common vendor formats, and clearly flags anything it
  couldn't find rather than leaving the user to guess it was extracted.

## 10. Architecture & tech stack

See [`architecture.md`](./architecture.md) for the proposed stack,
system diagram, and repo layout.
