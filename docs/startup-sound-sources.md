# Startup flourish sound sources

Research and provenance audit: **2026-09-04 (Asia/Tokyo)**.

## Selection and license

Only creator-hosted Kenney assets already vendored by this project are used.
Both official pack pages were live, downloadable, and still maintained in
Kenney's current asset catalogue on the audit date. Each page identifies the
pack as version **1.0**, released in **2014**, under **Creative Commons CC0**.

| Beat | Official pack / version | Original pack file | Vendored input | Mix | SHA-256 of vendored input |
| --- | --- | --- | --- | --- | --- |
| clasp opens | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) 1.0 | `metalLatch.ogg` | `public/audio/cues/clasp.wav` | 0 ms, gain 0.45 | `a1cd621a73e62a1d0a1fe2d2b47525703024536d9d273aafcf79fb9a9aa47c45` |
| cover lifts | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) 1.0 | `bookOpen.ogg` | `public/audio/cues/book-open.wav` | 200 ms, gain 0.45 | `4e5a53f095508b4e629315d47d54d0a62c21cbd4526e63ff6108716181eb0aac` |
| light rises | [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) 1.0 | `jingles_STEEL10.ogg` | `public/audio/cues/flourish.wav` | 400 ms, gain 0.50 | `f18331fa4d0cff7e0f574daeaf5e6cb58c62dcdf85004814b5db8713150e1830` |

The authoritative license is [CC0 1.0 Universal legal
code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en). The
[CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) summarizes that
the work may be copied, modified, distributed, and performed, including
commercially, without permission. Attribution is not required; Kenney remains
credited in `public/audio/cues/LICENSE.txt`.

No trademark, voice, likeness, personal data, or third-party account is
involved. The app serves the derived file from its own origin; runtime playback
does not disclose data to Kenney, Creative Commons, or another service.

## Reproducible derived asset

`public/audio/cues/startup-flourish.wav` is a deterministic single-clock mix,
not a new composition. One file prevents independent media downloads from
moving the three beats relative to each other on a cold start.

- Format: PCM signed 16-bit little-endian, 44.1 kHz, mono
- Duration: 1.308889 seconds (57,722 samples)
- Size: 115,522 bytes
- Peak: -7.0 dBFS
- SHA-256: `e0c0bacbd217aece6b478cc042f4f57f367e96b1f3938da67e0277c73817a942`
- Tool: FFmpeg 8.1 full build from gyan.dev, `libavfilter 11.14.100`

Reproduction command, run from the repository root:

```text
ffmpeg -y -v error -i public/audio/cues/clasp.wav -i public/audio/cues/book-open.wav -i public/audio/cues/flourish.wav -filter_complex [0:a]volume=0.45[a0];[1:a]volume=0.45,adelay=200:all=1[a1];[2:a]volume=0.5,adelay=400:all=1[a2];[a0][a1][a2]amix=inputs=3:duration=longest:normalize=0[out] -map [out] -ac 1 -ar 44100 -c:a pcm_s16le public/audio/cues/startup-flourish.wav
```

The manifest records the same hashes, gains, markers, duration, and output
hash. Focused tests fail if an input or the derived file changes without a
deliberate rebuild.

## Browser autoplay decision

Primary browser/platform sources consulted:

- [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay): audible
  autoplay can be allowed after origin interaction, sufficient desktop media
  engagement, or PWA/home-screen installation; `play()` rejection must still
  be handled.
- [WebKit autoplay policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/):
  assume audible media requires a gesture, inspect the `play()` promise, and
  keep sequential playback on one media element because grants are per element.
- [WHATWG HTML media specification](https://html.spec.whatwg.org/multipage/media.html):
  `pause()` rejects pending play promises and resetting the media resource stops
  an in-progress fetch/resource selection.

The existing Web Audio sampler was considered, as were three separate media
elements. The selected path is one native `HTMLAudioElement` using the mixed
file, with no new library, plugin, MCP, network permission, or runtime origin.
It improves the product only where the browser already permits autoplay:

1. Playback is attempted once, synchronously with the visual start, and never
   awaited, so audio loading cannot delay the overlay or underlying app.
2. A rejected attempt is paused and unloaded. It is never queued for the first
   unrelated gesture.
3. A second request cancels the first, preventing React development remounts or
   duplicate calls from stacking two cues.
4. Both the startup-effect setting and the independent sound setting must be
   enabled. Reduced motion suppresses the startup effect; live reduced-motion,
   visibility loss, skip, auto-dismiss, and unmount all cancel playback.

## Verification record

- `node --test tests/lib/domain/sound-cues.test.mjs tests/lib/sound-preferences.test.mjs`:
  **15/15 passed**. Covers asset/input hashes, exact markers, sound preference,
  synchronous return with pending playback, deduplication, idempotent cancel,
  and rejected-autoplay disposal.
- `pnpm typecheck`: **passed**.
- Focused ESLint on the changed TypeScript/test files: **passed**.
- Chrome DevTools against `http://127.0.0.1:3000/`: React development remount
  produced one `play()` request; audio disabled produced zero. Skip, a live
  reduced-motion change, and `visibilityState = hidden` each produced one
  `pause()` plus resource reset, with no second play. The audio request was
  issued in the same startup turn and did not gate rendering; the instrumented
  overlay committed 42 ms after the non-awaited request.
- The served derived file returned **200**, `audio/wav`, and **115,522 bytes**.
  The changed route had no console warning/error/issue.
