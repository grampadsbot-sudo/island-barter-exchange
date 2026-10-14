# IBE member review — Google Sheet setup

Each member gets their own link. Kim texts that link. The page at `/member-review` stays generic: it does not greet anyone and it does not show or ask for a name or business. The token in the link is how a submission is written onto that member's row.

The site repo is public. The web app URL is not a secret: `vite.config.js` commits it as `DEFAULT_SURVEY_ENDPOINT`, and a non-empty `VITE_SURVEY_ENDPOINT` overrides that default at build time. Do not commit member tokens, and do not put tokens in Vercel. There is no shared `SURVEY_TOKEN`.

## 1. Create the sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. Name it `IBE Member Review` (any name is fine).

## 2. Add the script

1. In the sheet, open **Extensions → Apps Script**.
2. The project is bound to this spreadsheet. Select everything in the default `Code.gs` file and replace it with the contents of [`Code.gs`](Code.gs) in this folder.
3. Click the save icon (or press Ctrl+S / Cmd+S). Leave the file name as `Code.gs`.
4. Open **Project Settings** (gear icon). The Google Apps Script runtime should be **V8** (the current default). Do not switch it off.
5. Do not add a script property for a token. Tokens are created later, one per member, on the sheet.

## 3. Deploy the web app

1. Click **Deploy → New deployment**.
2. Click the gear next to **Select type** and choose **Web app**.
3. Description: `IBE member review`.
4. **Execute as:** Me (the Google account that owns the sheet).
5. **Who has access:** Anyone.
6. Click **Deploy**.
7. Google will ask you to authorize the script. Choose the account that owns the sheet, continue through the permission review, and allow access. The script needs permission to edit this spreadsheet.
8. Copy the **Web app URL**. It ends in `/exec` and looks like `https://script.google.com/macros/s/…/exec`.

After you change `Code.gs` later: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The `/exec` URL stays the same. Reload the spreadsheet once so the **IBE Survey** menu appears.

## 4. Point the site at the web app

`vercel.json` sets the build command to `npm run build` and the output directory to `dist`. Vite inlines the survey URL into `/member-review` at build time. The default is `DEFAULT_SURVEY_ENDPOINT` in `vite.config.js`, which is the deployed web app:

`https://script.google.com/macros/s/AKfycbzAVmWZb-Sp83Ma5eocgnXR-ICsZXw5tvcfSuRTofAPRNzD1y9UewE9_PENy127k1KZdg/exec`

Leave `VITE_SURVEY_ENDPOINT` unset to use that URL. Set it only when a build should call a different web app. An empty value does not override the default. The URL is baked in at build time, so changing it requires a new build.

Locally, `npm run dev` and `npm run build` use the same default. To try another URL, copy `.env.example` to `.env` and set `VITE_SURVEY_ENDPOINT` there. `.env` is gitignored.

## 5. Add members and generate links

1. Reload the spreadsheet. A tab named **Members** is created the first time the script runs (when you open the menu or when the first link is checked).
2. On **Members**, row 1 is the header. Starting in row 2, type **Name**, **Business**, and **Phone**. Leave Token, Link, Status, and the answer columns blank.
3. Choose **IBE Survey → Generate links**.
4. The script fills **Token** and **Link** on every row that has a name, business, or phone and does not already have a token. A token is 64 random hex characters. The link is `https://islandbarterexchange.com/member-review?t=` plus that token.
5. Running **Generate links** again does not change tokens that are already filled. If a token is present and the link cell is empty, it fills only the link.
6. Text each member the **Link** from their own row. Do not put those links in the git repo.

Opening `/member-review` with no `?t=`, or with a token that is not on the Members tab, shows "Please use your invitation link." A token that matches a row which is not yet submitted opens the same generic form for everyone. The form does not display the member's name or business.

Each link works once. After that member submits, Status becomes `Submitted`. Opening the link again shows "This survey has already been completed. Thank you!" and does not show the form. A second submit does not change that member's row.

To let the same link be used again, clear the **Status** cell on that member's row (delete `Submitted` and leave the cell empty). Do not change the token or the link. The next successful submit fills the answer columns again and sets Status back to `Submitted`.

`doGet` only checks the token. It never returns a name, business, phone, or other member detail.

| Token | Response |
| --- | --- |
| Matches a row whose Status is empty | `{ "ok": true }` |
| Matches a row whose Status is `Submitted` | `{ "ok": false, "error": "used" }` |
| Missing or not on the Members tab | `{ "ok": false, "error": "unknown" }` |

## What gets stored

**Members** — one row per member. Kim fills the first three columns. The first successful survey writes the answer columns, sets Status to `Submitted`, and sets Submitted At. Later submits are rejected until Status is cleared.

| Column | Who fills it |
| --- | --- |
| Name | Kim |
| Business | Kim |
| Phone | Kim |
| Token | Generate links. Never replaced once set. |
| Link | Generate links. `https://islandbarterexchange.com/member-review?t=TOKEN` |
| Status | `Submitted` after a response. Clear this cell to open the link again. |
| Submitted At | Time of the accepted response |
| Likelihood to recommend (0-10) | Question 1 |
| Reasons for score | Question 2 |
| Sense of community | Question 3, 5 (Excellent) through 1 (Needs attention) |
| Quality of members | Question 3 |
| Members' passion for their businesses | Question 3 |
| Member listings, photos & business summaries | Question 3 |
| Ease of connecting with other members | Question 3 |
| Enjoy most | Question 4, optional |
| Add or improve | Question 5, optional |
| Business owner referral | Question 6, optional |
| Local charity | Question 7, optional |
| May share positive comments | Question 8, `Yes` or `No` |

**Responses log** — each accepted submission is appended with Result `accepted`. A submit for a token that is already `Submitted` does not change the Members row; it appends a row with Result `rejected-duplicate` and the answers from that attempt. Columns are Timestamp, Result, Name, Business, Phone, Token, then the same answer columns. Name, business, and phone on this tab are copied from the Members row inside the script. They are not shown on the web page.

Values that start with `=`, `+`, `-`, or `@` are prefixed with an apostrophe so Sheets does not treat them as formulas.

## Why `text/plain`

The browser posts the JSON body with `Content-Type: text/plain;charset=utf-8`. That is a simple request, so the browser does not send a CORS preflight. Apps Script web apps do not answer the preflight that `application/json` would trigger. `doPost` reads `e.postData.contents` and parses the JSON. The token check before the form is a GET to the same web app URL with `?t=`.
