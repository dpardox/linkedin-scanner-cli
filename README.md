# LinkedIn Scanner CLI

This project follows a **"presume fitness"** strategy when evaluating job offers.

> We assume that each offer might be a good fit, and we then actively look for reasons to discard it.

## Getting Started

### Authentication

Recommended approach: run the browser in visible mode, log in manually once, and let the app save the Playwright session state.

On the first run:

1. Start the scanner with `npm start`.
2. If no valid session is found, the browser will open LinkedIn login.
3. Complete the login manually in the browser window.
4. Once the session is detected, the app will save it to `.auth/linkedin-storage-state.json`.

On later runs, that saved session state will be reused automatically.

The session state is stored at `.auth/linkedin-storage-state.json`.

If LinkedIn closes the session, delete that file, run `npm start`, and log in manually again.

### Scanner setup

Run `npm start`. The terminal starts with the scanner preferences:

- search queries
- countries or locations
- languages
- work type
- Easy Apply
- include and exclude keywords
- final content search query
- whether unknown jobs should be shown

The answers are saved as semantic files in `db/` and reused automatically on later runs. Press Enter on any step to keep the saved value, or change it before continuing.

In option lists, use arrows to move, Space to select or unselect, and Enter to continue.

Matching rules live in `keywords/`, with one JSON file per keyword package. The setup menu shows those keyword packages and can still reuse rules saved during manual review.

The JSON files in `keywords/` are the source of the rule catalog.

The scanner automatically runs each configured search in this order:

1. Last day
2. Last week
3. Last month

The setup does not ask for `timePostedRange` because those ranges are handled automatically.

Run `npm i` to install the dependencies.

## How to run

Run `npm start` to launch the scanner.

---

## To keep in mind

- The use of method `waitForTimeout` is for preventing the browser overload and simulate human behavior.
- for you reemplaza el recent activity temporalmente
- Unknown jobs now go through the same manual review flow as any other shortlist hit. The scanner waits for you to dismiss them in LinkedIn before continuing.
- The TUI shows an exclusion keyword input during manual review. Use it to save terms that should discard future jobs into `keywords/`.
- The exclusion keyword input supports plain text with `Enter`, `/exclude term`, and `exclude: term`.
