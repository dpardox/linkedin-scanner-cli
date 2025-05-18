# LinkedIn Scanner CLI

This project follows a **"presume fitness"** strategy when evaluating job offers.

> We assume that each offer might be a good fit, and we then actively look for reasons to discard it.

## Getting Started

### Authentication via Cookie

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

7. Save the file. Now your scraper will authenticate using this cookie automatically.

⚠️ Note: The `li_at` cookie typically expires after about 2 weeks. If LinkedIn redirects you to the login page again, you may need to repeat this process.

### Configuration

Copy the `config.scraper.template.ts` file to `config.scraper.ts` and adjust the configuration as needed.

Run `npm i` to install the dependencies.

## How to run

Run `npm start` to lunch the scraper.

---

## To keep in mind

- The use of method `waitForTimeout` is for preventing the browser overload and simulate human behavior.
