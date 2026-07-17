# WesternRMP Privacy Policy

Last updated: July 17, 2026

WesternRMP adds RateMyProfessors information to Western University's DraftMySchedule website.

## Data the extension accesses

On `draftmyschedule.uwo.ca`, WesternRMP reads the professor names shown in schedule-result tables and the currently selected department. The department is used only in the browser to choose the closest matching result.

## Data sent to RateMyProfessors

To perform its core function, WesternRMP sends:

- the professor name shown on DraftMySchedule; and
- Western University's fixed RateMyProfessors school identifier

to `https://www.ratemyprofessors.com/graphql`. RateMyProfessors returns public professor ratings and review information. RateMyProfessors may receive standard network information, such as the user's IP address, when the request is made. RateMyProfessors handles that information under its own privacy practices.

This transmission is declared to Firefox as required `websiteContent` data because it is necessary to fetch a rating. If the user does not consent during Firefox installation, the extension cannot be installed.

## Storage and sharing

WesternRMP does not:

- create user accounts;
- collect analytics, telemetry, browsing history, or advertising identifiers;
- sell data;
- send data to the extension developer; or
- retain lookup data after the DraftMySchedule page is closed.

Successful rating lookups are cached only in memory for the lifetime of the current page so duplicate network requests can be avoided.

## Permissions

WesternRMP requests access only to:

- `draftmyschedule.uwo.ca`, where it reads professor names and displays ratings; and
- `www.ratemyprofessors.com`, where it requests public rating data.

## Questions

Privacy questions and issues can be filed at:
https://github.com/davidanukam/WesternRMP/issues
