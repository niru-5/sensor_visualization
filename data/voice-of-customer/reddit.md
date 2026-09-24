# Reddit VoC — 12 threads (Arctic Shift title search)

Source: `https://arctic-shift.photon-reddit.com/api/posts/search`
(queried live 2026-09-25; single-token queries, `sort=desc`).
Dates are `created_utc` as returned by the API. Permalinks are verbatim from the API.

## r/raspberry_pi (5)

### r-raspberry_pi-1g4nyka

- **Title:** What's the difference between HQ Camera C/CS and M12 lenses?
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1g4nyka/whats_the_difference_between_hq_camera_ccs_and/
- **Date:** 2024-10-16
- **Pain:** Users can't tell which lens mount fits the HQ camera or what the
  optical/coverage trade-offs are — mount confusion blocks the first purchase.

### r-raspberry_pi-1qtmszq

- **Title:** How to set arducam b0371 imx519's focus to infinite
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1qtmszq/how_to_set_arducam_b0371_imx519s_focus_to_infinite/
- **Date:** 2026-02-02
- **Pain:** Autofocus module won't hold infinity focus; no obvious
  manual-focus procedure — focus control is undiscoverable.

### r-raspberry_pi-yntdla

- **Title:** Understanding Raspi Cam v2 resolution vs FOV
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/yntdla/understanding_raspi_cam_v2_resolution_vs_fov/
- **Date:** 2022-11-06 (score 153 at crawl time — heavily upvoted)
- **Pain:** Changing resolution silently changes FOV (sensor crop/binning);
  users feel misled by the "resolution" setting — needs a calculator, not a dropdown.

### r-raspberry_pi-1uuaxmm

- **Title:** Would this work? I'm trying to extend my camera module 3 cable because it's too short.
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1uuaxmm/would_this_work_im_trying_to_extend_my_camera/
- **Date:** 2026-07-12
- **Pain:** Stock CSI flex is too short for real placements; users gamble on
  extender hacks with no signal-integrity guidance — cable length is a hidden constraint.

### r-raspberry_pi-1pn1abj

- **Title:** Need help finding the best low light, wide angle pi camera.
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1pn1abj/need_help_finding_the_best_low_light_wide_angle/
- **Date:** 2025-12-15
- **Pain:** Classic selection paralysis: "best low-light wide-angle" has no
  authoritative answer — buyers crowdsource because no parametric comparison exists.

## r/computervision (4)

### r-computervision-1vipntd

- **Title:** Hardware advice for close-range Iris Recognition in the dark (IMX290 vs. OV9281)?
- **URL:** https://www.reddit.com/r/computervision/comments/1vipntd/hardware_advice_for_closerange_iris_recognition/
- **Date:** 2026-08-08
- **Pain:** Close-up GSD + NIR sensitivity trade-off between two sensors;
  no tool answers "which sensor resolves the iris at distance X in the dark".

### r-computervision-1w9nud3

- **Title:** Camera recommendation for real-time object tracking on a conveyor belt (Budget: ~$150 - $280)
- **URL:** https://www.reddit.com/r/computervision/comments/1w9nud3/camera_recommendation_for_realtime_object/
- **Date:** 2026-09-07 (score 157 at crawl time — heavily upvoted)
- **Pain:** Conveyor tracking needs global shutter + enough FPS on a budget;
  rolling-shutter blur ruins detection and buyers don't know the minimum viable spec.

### r-computervision-1rpyu0s

- **Title:** Looking for a mon/global-shutter camera (120–500 FPS) for DIY eye tracker <$400 if possible
- **URL:** https://www.reddit.com/r/computervision/comments/1rpyu0s/looking_for_a_monglobalshutter_camera_120500_fps/
- **Date:** 2026-03-10
- **Pain:** Eye tracking demands mono + global shutter + high FPS over a
  usable interface under $400 — that intersection is nearly unsearchable.

### r-computervision-1w48m73

- **Title:** Where can I buy an IP67 GigE/PoE camera with Sony IMX462 sensor in India?
- **URL:** https://www.reddit.com/r/computervision/comments/1w48m73/where_can_i_buy_an_ip67_gigepoe_camera_with_sony/
- **Date:** 2026-09-01
- **Pain:** Even with exact sensor + interface + rating picked out, sourcing a
  large-sensor industrial camera regionally is hard — selection includes availability.

## r/embedded (2)

### r-embedded-1w6yys9

- **Title:** Hurdles of Writing a Camera Driver in Linux
- **URL:** https://www.reddit.com/r/embedded/comments/1w6yys9/hurdles_of_writing_a_camera_driver_in_linux/
- **Date:** 2026-09-04
- **Pain:** Bringing a sensor up on Linux (V4L2/media pipeline, device tree)
  is a wall of tribal knowledge — driver effort dwarfs hardware cost.

### r-embedded-1w6sizz

- **Title:** CSI-2 Camera Adaptor Boards for Orin AGX
- **URL:** https://www.reddit.com/r/embedded/comments/1w6sizz/csi2_camera_adaptor_boards_for_orin_agx/
- **Date:** 2026-09-04
- **Pain:** Physically connecting a CSI-2 sensor to an Orin AGX needs an
  adaptor board; pinout/compat info is scattered across vendors and forum threads.

## r/machinevision (1)

### r-machinevision-1o2ui9n

- **Title:** Compact 3D-Vision setup on a robotic car — testing active perception
- **URL:** https://www.reddit.com/r/machinevision/comments/1o2ui9n/compact_3dvision_setup_on_a_robotic_car_testing/
- **Date:** 2025-10-10
- **Pain:** Compact 3D vision on a mobile robot forces stereo/depth, compute
  and size trade-offs with no compact reference designs to copy.
