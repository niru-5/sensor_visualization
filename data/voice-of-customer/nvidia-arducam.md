# NVIDIA Jetson + Arducam VoC — 10 threads (Discourse JSON APIs)

Sources (queried live 2026-09-25):

- `https://forums.developer.nvidia.com/search.json?q=…`
- `https://forum.arducam.com/search.json?q=…`

Dates are topic `created_at` from the API. URLs are canonical
`https://<host>/t/<slug>/<topic_id>` as returned by the API.

## NVIDIA Jetson forums (5)

### nvidia267033

- **Title:** CSI Camera Compatibility
- **URL:** https://forums.developer.nvidia.com/t/csi-camera-compatibility/267033
- **Date:** 2023-09-20
- **Pain:** "Which CSI cameras work with my Jetson?" has no reliable matrix —
  buyers post and pray instead of filtering by board + JetPack.

### nvidia349380

- **Title:** Jetson Orin NX 16G CSI Pinout
- **URL:** https://forums.developer.nvidia.com/t/jetson-orin-nx-16g-csi-pinout/349380
- **Date:** 2025-10-29
- **Pain:** Carrier-board CSI pinout confusion stalls custom hardware;
  pinout docs don't answer "will this camera's flex mate with this connector".

### nvidia340841

- **Title:** IMX477 CSI Camera Fails in Headless Mode (VNC/Xorg) but Works with Physical Display
- **URL:** https://forums.developer.nvidia.com/t/imx477-csi-camera-fails-in-headless-mode-vnc-xorg-but-works-with-physical-display/340841
- **Date:** 2025-07-31
- **Pain:** Camera works on the bench, dies headless in deployment (display/
  Xorg dependency) — the cruelest kind of "works on my machine".

### nvidia311050

- **Title:** Compatibility of Jetson Orin Nano with Raspberry Pi Global Shutter Camera (IMX296)
- **URL:** https://forums.developer.nvidia.com/t/compatibility-of-jetson-orin-nano-with-raspberry-pi-global-shutter-camera-imx296/311050
- **Date:** 2024-10-24
- **Pain:** The go-to affordable global-shutter module (Pi GS / IMX296) has
  murky Jetson support — shutter needs go unmet on the most popular edge board.

### nvidia332548

- **Title:** Issue Installing Arducam IMX477 Driver on Jetson (RuntimeError: Mountpoint /mnt/APP already exists)
- **URL:** https://forums.developer.nvidia.com/t/issue-installing-arducam-imx477-driver-on-jetson-runtimeerror-mountpoint-mnt-app-already-exists/332548
- **Date:** 2025-05-08
- **Pain:** Third-party driver install scripts brick or half-fail on stock
  JetPack — driver friction turns a $50 camera into a day of reflashing.

## Arducam forum (5)

### arducam10210

- **Title:** Arducam IMX477 camera no image on Jetson Xavier NX
- **URL:** https://forum.arducam.com/t/arducam-imx477-camera-no-image-on-jetson-xavier-nx/10210
- **Date:** 2026-07-12
- **Pain:** Same sensor, different platform (Pi → Jetson) = no image;
  cross-platform support is a per-board lottery.

### arducam10813

- **Title:** Autofocus and motorized focus not working on Arducam IMX519 ak7375 cameras on Raspberry Pi
- **URL:** https://forum.arducam.com/t/autofocus-and-motorized-focus-not-working-on-arducam-imx519-ak7375-cameras-on-raspberry-pi/10813
- **Date:** 2025-02-06
- **Pain:** Motorized-focus driver (AK7375/libcamera) silently broken —
  focus is a software feature users discover is missing after purchase.

### arducam5545

- **Title:** Where to buy C, CS, and M12 mount lenses + info on IR capture
- **URL:** https://forum.arducam.com/t/where-to-buy-c-cs-and-m12-mount-lenses-info-on-ir-capture/5545
- **Date:** 2023-08-03
- **Pain:** Lens mounts and IR-cut options are a sourcing maze; buyers can't
  map mount → sensor coverage → day/night suitability in one place.

### arducam8102

- **Title:** How to determine pixel-to-millimeter ratio using an Arducam camera with known focus?
- **URL:** https://forum.arducam.com/t/how-to-determine-pixel-to-millimeter-ratio-using-an-arducam-camera-with-known-focus/8102
- **Date:** 2025-03-21
- **Pain:** Users hand-derive pixel↔mm from focus distance — exactly the GSD
  math a selection tool should compute automatically.

### arducam5585

- **Title:** Is the fov calculation of B0202 correct?
- **URL:** https://forum.arducam.com/t/is-the-fov-calculation-of-b0202-correct/5585
- **Date:** 2023-08-10
- **Pain:** Even vendor-published FOV numbers get challenged — buyers don't
  trust datasheet optics and re-derive them on forums.
