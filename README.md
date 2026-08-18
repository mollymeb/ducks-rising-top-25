# Ducks Rising Top 25 Ballot

A branded, mobile-friendly Top 25 ballot with a Google Sheets backend. Each ballot gives 25 points to the first-ranked team, 24 to second, down to 1 point for 25th. The `Results` sheet updates automatically after every submission.

## Preview locally

Run a static server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Connect Google Sheets

1. Create a blank Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with `google-apps-script/Code.gs` from this project and save.
4. Choose **Deploy → New deployment → Web app**.
5. Set **Execute as** to yourself and **Who has access** to anyone. Deploy and approve access.
6. Copy the Web App URL ending in `/exec` into `config.js` as the `endpoint` value.
7. Submit one test ballot. The script creates `Ballots` and `Results` tabs automatically.

Google may show an “unverified” warning during your own authorization because this is your private script. The public does not authorize the script; the web app executes as you.

## Publish the site

This is a static site, so it can be hosted free on GitHub Pages, Netlify, Cloudflare Pages, or Vercel. Upload the project files, then share the generated public URL.

## Customize

- Change the poll name in `config.js`.
- Edit colors near the top of `styles.css`.
- Edit the `TEAMS` list in `app.js` when conference membership changes.
- The Google Sheet stores voter email. Restrict sheet access accordingly.

## Duplicate voting

The sheet includes a one-way voter fingerprint, but the current version accepts repeat submissions so a voter can correct a ballot. To enforce one ballot per email, add a lookup in `doPost` before `appendRow`, or deduplicate the sheet by the `Voter ID` column before publishing final results.
