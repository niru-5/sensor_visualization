# Ground-plane / frustum collision fix — `FovCone3D.tsx`

## Root cause

- Optical axis is **+Z**: camera rig sits at the origin, frustum rays run from
  `(0,0,0)` to the footprint corners `(±fw, ±fh, wd)`, and the footprint fill is a
  **vertical** `planeGeometry` (XY plane) at `z = workingDistanceMm` spanning
  `y = ±fh`, where `fh = verticalFovMm / 2` grows ~linearly with working distance.
- The drei `<Grid>` floor is a **horizontal** XZ plane (normal +Y). It was parked at
  a fixed `y = -diagonal * 4` (sensor diagonal, typically ~8–13 mm → floor at
  roughly −32…−53 mm), independent of working distance.
- As soon as `fh > diagonal * 4` (normal at anything beyond short/macro working
  distances), the floor plane sat **inside** the frustum volume and cut through the
  vertical footprint rectangle: the lower frustum ray `y(z) = −fh·z/wd` crosses the
  old floor at `z = wd·diagonal·4/fh < wd`, i.e. mid-frustum.

## Fix (`src/components/FovCone3D.tsx` only)

Kept `CameraRig`, frustum rays, footprint rectangle/outline, `OrbitControls`, and
the shared `sceneScaleMm` logic intact. Only the floor Y changed:

```ts
const fovForFloor = computeFov(sensor, lens.focalLengthMm, wd)
const fhForFloor = (fovForFloor.vertical.fovMm ?? 0) / 2
const lensBottom = Math.max(4, Math.min(swHalf, shHalf) * 0.85) * 1.15
const cameraBottom = Math.max(shHalf * 1.3, lensBottom) // box half-height vs lens radius
const lowestY = -Math.max(fhForFloor, cameraBottom)
const floorMargin = Math.max(diagonal * 0.5, Math.abs(lowestY) * 0.08, scale * 0.01)
const groundY = lowestY - floorMargin
// <Grid args={[scale*4, scale*4]} position={[0, groundY, 0]} ... />
```

- Orientation stays horizontal (correct for a floor); it is **repositioned** below
  the lowest point of the whole rig — footprint bottom edge vs. camera-body/lens
  bottom, whichever is lower — so there is no intersection with the frustum, the
  footprint mesh, or the camera frame.
- Margin `max(diagonal·0.5, |lowest|·8%, scale·1%)` keeps clearance proportional
  across macro → long working distances and stays sensible under a shared
  `sceneScaleMm` (large comparison scale adds a small extra push-down instead of
  detaching the floor).
- Grid extent (`scale*4`), fade (`scale*3`), camera, fog, lights, and controls
  targets are untouched, so multi-stage 1:1 framing is preserved.

## Verification (analytic, thin-lens FOV math)

Sensor 6.4×4.8 mm, f=8 mm (`diag=8.0`):

| wd (mm) | fh (mm) | old floor Y | old result | new floor Y | clearance below footprint |
|---|---|---|---|---|---|
| 30 | 6.6 | −32.0 | clear (near plane only) | −10.6 | 4.0 |
| 500 | 147.6 | −32.0 | **slices frustum + footprint** | −159.4 | 11.8 |
| 2000 | 597.6 | −32.0 | **slices frustum + footprint** | −645.4 | 47.8 |
| 8.5 (macro) | 0.1 | −32.0 | clear but detached | −8.6 | 8.4 (camera-bound) |

Shared-scale case (11.3×7.1 mm, f=12, wd=100, scale=2000): new floor −46.0,
20 mm below footprint, 41.4 mm below camera — clear with no visual detachment.
Invalid-geometry case (wd ≤ f, `fovMm = null`) falls back to `fh = 0`, so the
floor keys off the camera body and never divides by zero.

## Checks run

- `npm run typecheck` (`tsc -b`): **no errors in `src/components/FovCone3D.tsx`**.
  The only errors are pre-existing in `api/_lib/fetchContent.ts` (PDFDocumentProxy
  typing, `doc` possibly undefined, implicit `any` — untouched by this change; that
  file already had working-tree modifications before this fix).
- `npm run lint` (`oxlint`): exit 0; only warnings in `.pi/extensions/**`
  (unused imports/vars), none in `src/`.
- No changes to App layout, wizard, or API code.
- Live visual check (OrbitControls scene render) was not run in this environment;
  clearances above are derived from the same `computeFov` the scene renders, so
  the floor is guaranteed below the rendered geometry by construction.
