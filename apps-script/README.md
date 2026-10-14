# IBE member review — Google Sheet setup

Responses from `/member-review` are appended to a Google Sheet by a bound Apps Script web app. The site repo is public. Do not commit the web app URL or the invite token, and do not put the token in Vercel.

The page reads the token from the `?t=` query parameter and posts it with the answers. The script compares it to the Script Property `SURVEY_TOKEN`. A missing or wrong token is rejected. The token is not stored in the sheet.

## 1. Create the sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. Name it `IBE Member Review responses` (any name is fine).

## 2. Add the script

1. In the sheet, open **Extensions → Apps Script**.
2. The project is bound to this spreadsheet. Select everything in the default `Code.gs` file and replace it with the contents of [`Code.gs`](Code.gs) in this folder.
3. Click the save icon (or press Ctrl+S / Cmd+S). Leave the file name as `Code.gs`.
4. Open **Project Settings** (gear icon). The Google Apps Script runtime should be **V8** (the current default). Do not switch it off.

## 3. Set the shared token

1. Still in **Project Settings**, find **Script Properties**.
2. Click **Add script property** (or **Edit script properties**).
3. Property: `SURVEY_TOKEN`
4. Value: a long random string. On your computer, generate one with:

   ```bash
   openssl rand -base64 32
   ```

5. Save the property.

Keep this value secret. It is the only thing that authorizes a write. Do not commit it, do not add it as a Vercel environment variable, and do not paste it into this repository. Rotating it later is a property change only: old invitation links stop working as soon as you save the new value. The site does not need a rebuild for a token change.

## 4. Deploy the web app

1. Click **Deploy → New deployment**.
2. Click the gear next to **Select type** and choose **Web app**.
3. Description: `IBE member review`.
4. **Execute as:** Me (the Google account that owns the sheet).
5. **Who has access:** Anyone.
6. Click **Deploy**.
7. Google will ask you to authorize the script. Choose the account that owns the sheet, continue through the permission review, and allow access. The script needs permission to edit this spreadsheet.
8. Copy the **Web app URL**. It ends in `/exec` and looks like `https://script.google.com/macros/s/…/exec`.

After you change `Code.gs` later: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The `/exec` URL stays the same.

## 5. Point the site at the web app

The page does not contain the URL. Vite inlines `VITE_SURVEY_ENDPOINT` when the site is built.

1. In the Vercel project, open **Settings → Environment Variables**.
2. Add `VITE_SURVEY_ENDPOINT` for Production (and Preview, if you want the survey on preview deploys).
3. Set the value to the Web app URL you copied. Nothing else: no quotes, no invite token.
4. Set the Vercel project **Build Command** to `npm run build` and **Output Directory** to `dist`. The URL is baked in at build time. Saving the variable does nothing until the next build.
5. Redeploy the site.

Locally:

```bash
cp .env.example .env
```

Put the same Web app URL in `.env` as `VITE_SURVEY_ENDPOINT=`. `.env` is gitignored. Then:

```bash
npm run dev
```

Open `http://localhost:5173/member-review?t=YOUR_TOKEN`.

## 6. Send the invitation link

Use the real site origin plus the token from step 3:

```text
https://islandbarterexchange.com/member-review?t=YOUR_TOKEN
```

The page is not linked from the navigation. It sends `<meta name="robots" content="noindex">`. Opening `/member-review` without `?t=` shows a short note asking the member to use their invitation link.

## What gets stored

Each submission adds one row on a tab named **Responses** (created automatically):

| Column | Source |
| --- | --- |
| Timestamp | Server time when the row is written |
| Likelihood to recommend (0-10) | Question 1, required |
| Reasons for score | Question 2, required |
| Sense of community | Question 3, required, 5 (Excellent) through 1 (Needs attention) |
| Quality of members | Question 3 |
| Members' passion for their businesses | Question 3 |
| Member listings, photos & business summaries | Question 3 |
| Ease of connecting with other members | Question 3 |
| Enjoy most | Question 4, optional |
| Add or improve | Question 5, optional |
| Name | Question 6, optional |
| Business name | Question 6, optional |
| Business owner referral | Question 7, optional |
| Local charity | Question 8, optional |
| May share positive comments | Question 9, `Yes` or `No` |

Values that start with `=`, `+`, `-`, or `@` are prefixed with an apostrophe so Sheets does not treat them as formulas.

## Why `text/plain`

The browser posts the JSON body with `Content-Type: text/plain;charset=utf-8`. That is a simple request, so the browser does not send a CORS preflight. Apps Script web apps do not answer the preflight that `application/json` would trigger. `doPost` reads `e.postData.contents` and parses the JSON.
