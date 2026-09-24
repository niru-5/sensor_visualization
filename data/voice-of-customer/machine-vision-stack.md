# Machine-vision Stack VoC — 10 threads (Stack Exchange API)

Source: `https://api.stackexchange.com/2.3/search/advanced` (queried live
2026-09-25, `sort=relevance`). IDs and scores verified live; links use the
canonical `https://<site>/q/<id>` short form so they resolve regardless of slug.

## Photo.SE (6)

### photo135377

- **Title:** How can I calculate the focal length, sensor size, and resolution for a machine vision camera given angle and field of view and working distance?
- **URL:** https://photo.stackexchange.com/q/135377
- **Date:** question id 135377 (score 1 at crawl time)
- **Pain:** The canonical tool-shaped question: angle + FOV + working distance
  → focal length, sensor, resolution. Asked outright; answered by hand, once.

### photo132122

- **Title:** How to calculate the required working distance for an object to fill the camera sensor?
- **URL:** https://photo.stackexchange.com/q/132122
- **Date:** question id 132122 (score 2 at crawl time)
- **Pain:** Inverted workflow — object size fixed, working distance unknown —
  users solve the lens equation manually instead of sliding a WD control.

### photo131213

- **Title:** Field of view calculation by camera parameters + radial distortion
- **URL:** https://photo.stackexchange.com/q/131213
- **Date:** question id 131213 (score 1 at crawl time)
- **Pain:** Thin-lens FOV math breaks under real distortion; users want FOV
  from calibration parameters, not datasheet angles.

### photo130699

- **Title:** What determines the image circle diameter?
- **URL:** https://photo.stackexchange.com/q/130699
- **Date:** question id 130699 (score 3 at crawl time)
- **Pain:** Lens image-circle vs sensor size (coverage/vignetting) is folk
  knowledge — buyers discover mechanical vignetting after mounting the lens.

### photo86448

- **Title:** How to calculate the radius of the image circle?
- **URL:** https://photo.stackexchange.com/q/86448
- **Date:** question id 86448 (score 3 at crawl time)
- **Pain:** Companion to the above: users want a number for coverage, and
  only get rules of thumb — same gap as mount-compatibility checking.

### photo43451

- **Title:** How does a sensor cause vignetting?
- **URL:** https://photo.stackexchange.com/q/43451
- **Date:** question id 43451 (score 7 at crawl time)
- **Pain:** Sensor-stack vignetting surprises buyers who matched mount and
  sensor size correctly — coverage math alone doesn't catch it.

## StackOverflow (4)

### so11222813

- **Title:** 2 usb cameras not working with opencv
- **URL:** https://stackoverflow.com/q/11222813
- **Date:** question id 11222813 (score 4 at crawl time)
- **Pain:** Multi-USB-camera setups hit bandwidth/enumeration walls in
  OpenCV — interface limits surface at integration time, not selection time.

### so73080768

- **Title:** Docker container can't access Basler GigE vision camera
- **URL:** https://stackoverflow.com/q/73080768
- **Date:** question id 73080768 (score 3 at crawl time)
- **Pain:** GigE Vision + Docker networking (broadcast/GVSP) breaks camera
  discovery in containers — deployment interface pain invisible on datasheets.

### so10168686

- **Title:** Image Processing: Algorithm Improvement for 'Coca-Cola Can' Recognition
- **URL:** https://stackoverflow.com/q/10168686
- **Date:** question id 10168686 (score ~1900 at crawl time — canonical thread)
- **Pain:** The famous lighting-vs-algorithm lesson: color/lighting variation
  defeats edge pipelines — selection must consider illumination, not just the camera.

### so31444235

- **Title:** Image processing for automatic defect detection in product
- **URL:** https://stackoverflow.com/q/31444235
- **Date:** question id 31444235 (score 1 at crawl time)
- **Pain:** Defect detection lives or dies on resolving the defect (GSD) under
  production lighting — resolution questions are really system questions.
