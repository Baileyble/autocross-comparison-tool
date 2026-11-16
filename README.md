# RaceCompare — autocross run video comparison

Sync autocross run videos and compare them side by side, keep a record of every run, and find where you're gaining or losing time.

It's a static web app: no server, no build step, no accounts. Videos stay on your device (they're stored in your browser's IndexedDB if you choose); nothing is uploaded.

## What it does

**Import & organize**
- Drop video files anywhere (or paste YouTube links). Files are ordered by their recorded time and numbered as runs automatically.
- Runs belong to **events** (date, site, club, course name, conditions, notes, course-map image) and have a **driver** and **car**.
- Per run: raw time, cones, status (clean / DNF / off course / DSQ / rerun), adjusted time (cone penalty configurable, default 2 s), tags, setup notes (tire pressures etc.), notes, and a 1–5 self-rating.
- Quick-entry table on the event page for typing times and cones as the results come in. "Run without video" keeps a record even when the camera wasn't rolling.
- One video containing several runs? **Find runs in this video** splits it into runs by detecting the stretches where the car is driving.

**Start sync**
- After import, each local video is analyzed in the browser (a fast, muted playback pass): it detects the **launch from camera motion** — skipping the creep up to the line — and refines it frame by frame. Auto marks are flagged `auto` until you confirm them.
- Run editor: frame-step (←/→), set start (S), splits (1–9), finish (F), timed notes (N). A zoomable timeline shows camera motion and audio loudness so the launch and finish are easy to spot; drag the flags to adjust.
- Enter the official time and the finish is placed automatically (start + time).
- In the compare view, **Adjust sync** lets you step each video on its own and "Set start here" without leaving the comparison.

**Compare (2–4 runs)**
- **Real time**: every run starts together, so you see who pulls ahead and by how much.
- **Position-locked**: runs are time-warped so they arrive at every split together — compare lines and braking points at the same spot on course.
- **Align by marks or by video**: with local videos, "✨ Video" matches what the cameras see (frame fingerprints + dynamic time warping) for a continuous alignment without marking splits. It works best with the same camera mount (e.g. co-drivers in one car); verify it in position-locked mode.
- Live **delta** on each video vs the reference run, a **delta graph** along the course, and a **segment table** (click a segment to loop it).
- Side-by-side, stacked, or **overlay/ghost** (opacity + difference blend). Scroll to zoom into a video, drag to pan (linked across videos by default).
- Timed notes pop up during playback. Pick which run's audio you hear. Playback 0.1×–2×, fullscreen.
- **Share link** for YouTube comparisons: marks and times are encoded in the URL, nothing uploaded. Old `?v1=&v2=&t1=&t2=` links from the previous version still open.

**Track progress**
- Event page: best run per driver, Δ to own best, progression chart, **segment times with best segments highlighted**, and **theoretical best** (sum of your best segments).
- Progress page: per driver across events — best time, % of a reference time (FTD / class winner, entered per event), gap to the fastest driver you recorded, first-run → best improvement, consistency (spread of clean runs), cones and DNFs, and same-course history when the course name matches.
- Backup/restore as JSON, CSV export of all runs.

Press `?` in the app for keyboard shortcuts.

## Running it

Any static file server works (ES modules don't load from `file://`):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. It also works as-is on GitHub Pages; over HTTPS it caches itself for offline use at the track.

## Tests

```bash
npm test          # unit tests: timing math, warping, split tables, launch detection, DTW alignment
npm run test:e2e  # headless Chromium end-to-end run on synthetic videos with known ground truth
```

The e2e test generates two synthetic "in-car" videos (needs `python3` with numpy + Pillow, and `ffmpeg`) where the launch times and the time mapping between the runs are known exactly, then drives the real UI: import → auto start detection → time entry → split marking → synced playback → position-locked playback → video alignment → overlay/loop → progress page → legacy share link.

## Limitations & notes

- **Codecs**: H.264 MP4 plays everywhere. HEVC/H.265 (some GoPro/iPhone modes) depends on browser and OS support; convert if a file won't play.
- **YouTube**: the YouTube player can't be read pixel by pixel, so motion analysis, auto start detection and video alignment need local files. YouTube only supports a few fixed playback speeds, so position-locked mode keeps YouTube videos aligned with small jumps rather than smooth speed changes.
- **Launch detection** finds the first visible movement. From a standstill the first few frames move by less than a pixel, so the mark can land a few frames after the true launch. That bias is usually the same for every run, so sync isn't affected much, but check it with the frame buttons.
- **Video alignment** assumes the runs follow the same course and the cameras see similar things. Different cars or mounts, or very different lighting, reduce accuracy. The app warns when the match looks poor.
- Storage: with "keep copies" on, videos count against the browser's storage quota (usually a large share of free disk). Turn it off in Settings to store only data and re-link files each session.

`legacy.html` is the previous single-file version of the tool.
