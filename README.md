# LinkedIn Scanner CLI

This project follows a **"presume fitness"** strategy when evaluating job offers.

> We assume that each offer might be a good fit, and we then actively look for reasons to discard it.

## Getting Started

### Environment file

Copy the example environment file and rename it to `.env`:

```bash
cp .env.example .env
```

### Authentication

Recommended approach: run the browser in visible mode, log in manually once, and let the app save the Playwright session state.

On the first run:

1. Start the scanner with `npm start`.
2. If no valid session is found, the browser will open LinkedIn login.
3. Complete the login manually in the browser window.
4. Once the session is detected, the app will save it to `.auth/linkedin-storage-state.json`.

On later runs, that saved session state will be reused automatically.

### Optional Cookie Fallback

To avoid automating the login process, this project uses the `li_at` session cookie from LinkedIn.

1. Open LinkedIn in your browser (Chrome, Safari, or Firefox) and log in.
2. Open Developer Tools (right-click → "Inspect" or press `F12`) and go to the **Application** tab.
3. In the left menu, under **Storage**, select **Cookies** → `https://www.linkedin.com`.
4. Locate the cookie named `li_at`, and copy its value.
5. Open the `.env` file at the root of this project.
6. Add the following line:

```
LINKEDIN_COOKIE="your_li_at_cookie_value_here"
```

Optionally, you can also configure where the saved Playwright session state will be stored:

```
LINKEDIN_STORAGE_STATE_PATH=".auth/linkedin-storage-state.json"
```

7. Save the file. Now your scanner will authenticate using this cookie automatically.

⚠️ Note: The cookie fallback is less stable than a saved session state. If LinkedIn closes the session, delete the saved state file, run `npm start`, and log in manually again.

### Configuration

Copy the `config.scanner.template.ts` file to `config.scanner.ts` and adjust the configuration as needed.

Run `npm i` to install the dependencies.

## How to run

Run `npm start` to launch the scanner.

---

## To keep in mind

- The use of method `waitForTimeout` is for preventing the browser overload and simulate human behavior.
