# Mozilla Reviewer Notes

## Purpose

WesternRMP displays public RateMyProfessors ratings beside professor names on Western University's DraftMySchedule course-planning website.

## How to test

1. Install the submitted Firefox package.
2. Open `https://draftmyschedule.uwo.ca/`.
3. Select a subject and display course results containing professor names.
4. A numeric rating should appear beside a professor when a matching RateMyProfessors profile exists.
5. Hover over, focus, or click the professor name to open the detail panel. Press Escape to close it.

No Western account is required to open DraftMySchedule at the time of submission. If the site changes its access requirements, please contact the developer through the repository issue tracker.

## Network behavior

- The content script reads professor names and the selected department from schedule-result tables.
- The background script sends the professor name and Western's fixed school ID to the undocumented RateMyProfessors GraphQL endpoint.
- The selected department stays local and is used only to disambiguate matching search results.
- The endpoint uses RateMyProfessors' publicly used `test:test` Basic credential. It is not a developer secret.
- This third-party endpoint is unofficial and may become unavailable or change without notice.

## Security and privacy

- No remote executable code is downloaded or evaluated.
- All remote strings are inserted using DOM APIs and `textContent`, never `innerHTML`.
- No analytics, telemetry, user accounts, persistent storage, or developer-controlled server is used.
- Successful results are cached only in page memory to avoid duplicate requests.
- Firefox data collection permission `websiteContent` is required because a professor name read from the page is transmitted to RateMyProfessors.
- Full disclosure is in `PRIVACY.md` and should be copied into the AMO privacy-policy field.

## Permissions

- `https://draftmyschedule.uwo.ca/*`: content-script access to the supported schedule builder.
- `https://www.ratemyprofessors.com/*`: background access to fetch public rating data and open profile links.

## Source and build

The submitted package contains readable, unminified JavaScript copied directly from this repository. There is no bundling, transpilation, generated runtime code, or remote dependency. `npm run package:firefox` stages an allowlist of runtime files and uses Mozilla's `web-ext` tool to create the ZIP.
