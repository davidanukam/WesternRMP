# WesternRMP

WesternRMP shows RateMyProfessors information directly in Western University's DraftMySchedule.

- [Chrome Web Store listing](https://chromewebstore.google.com/detail/westernrmp/kadicmbbohhejeaooldihbejljmghfbf)
- [Privacy policy](PRIVACY.md)
- [Report an issue](https://github.com/davidanukam/WesternRMP/issues)

## Features

- Adds the average rating beside matched professor names.
- Shows rating details on hover, keyboard focus, or click.
- Supports keyboard and touch interaction with responsive, viewport-aware details.
- Matches duplicate names by department when possible.
- Handles schedule results added dynamically without reloading the page.
- Deduplicates and limits requests for faster, smoother page updates.

WesternRMP uses RateMyProfessors' undocumented GraphQL endpoint. It is not affiliated with or endorsed by RateMyProfessors, Western University, or Mozilla, and the endpoint can change without notice.

## Local development

Requirements:

- Node.js 20 or newer
- npm
- Firefox for Firefox testing

Install the release tooling:

```sh
npm install
```

Run tests and Firefox's add-on validator:

```sh
npm test
npm run lint:firefox
```

Stage browser-specific unpacked builds:

```sh
npm run stage
```

The generated directories are:

- `build/firefox`
- `build/chrome`

### Load temporarily in Firefox

1. Run `npm run stage`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `build/firefox/manifest.json`.
5. Open DraftMySchedule and display course results.

Temporary add-ons are removed when Firefox closes. You can also run:

```sh
npx web-ext run --source-dir build/firefox
```

### Load unpacked in Chrome

1. Run `npm run stage`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose `build/chrome`.

## Build release packages

```sh
npm run release
```

This command tests, validates, and creates:

- `dist/westernrmp-firefox-v1.1.0.zip`
- `dist/westernrmp-chrome-v1.1.0.zip`

Only files required at runtime are included. Documentation screenshots, tests, source-control files, and release tooling are excluded.

## Firefox release checklist

1. Run `npm run release` and fix every validation error.
2. Inspect the Firefox ZIP and confirm `manifest.json` is at its root.
3. Test a clean temporary install and the interaction flow documented in [REVIEWER_NOTES.md](REVIEWER_NOTES.md).
4. Publish `PRIVACY.md` at a stable public URL and copy its text into the AMO privacy-policy field.
5. Upload the Firefox ZIP to the [AMO Developer Hub](https://addons.mozilla.org/developers/).
6. Copy the relevant details from `REVIEWER_NOTES.md` into **Notes for Reviewers**.
7. Keep the Firefox add-on ID in `manifest.firefox.json` unchanged in every future release.
8. For updates, increase the version in `package.json`, both manifests, and package filenames, then upload from the existing AMO listing.

## Privacy summary

The extension sends a professor name displayed on DraftMySchedule and Western's fixed school identifier to RateMyProfessors to retrieve public rating data. It does not use analytics, persistent storage, or a developer-controlled server. See [PRIVACY.md](PRIVACY.md) for the complete disclosure.
