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

### Configuration

Copy the `config.scanner.template.ts` file to `config.scanner.ts` and adjust the configuration as needed.

Include/exclude matching rules now live in `rules/catalog.jsonl`. The config uses `createKeywordsFromPersistedRules(...)` to select rule IDs and can still append one-off keywords with `includeKeywords` and `excludeKeywords`.

If `rules/catalog.jsonl` does not exist yet, the scanner seeds it automatically from the current built-in rule packs the first time the config is loaded.

The scanner automatically runs each configured search in this order:

1. Last day
2. Last week
3. Last month

Do not set `timePostedRange` manually in the config.

Run `npm i` to install the dependencies.

## How to run

Run `npm start` to launch the scanner.

---

## To keep in mind

- The use of method `waitForTimeout` is for preventing the browser overload and simulate human behavior.
- for you reemplaza el recent activity temporalmente
- Unknown jobs now go through the same manual review flow as any other shortlist hit. The scanner waits for you to dismiss them in LinkedIn before continuing.
- The TUI shows a rule input during manual review. Use it to save future include/exclude rules into `rules/catalog.jsonl`.
- The rule input supports plain text with `Enter`, or commands such as `/include term`, `/exclude term`, `/delete rule-id`, and `/clear`.
