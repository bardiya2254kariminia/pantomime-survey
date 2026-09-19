# PanToMime user study

A ranking-style user study site, modelled on the [SIA survey](https://kianizadpanah.github.io/sia_survey/).
Participants see an exemplar pair **A → A′** and a new image **B**. For each question they rank the best 3
of several method outputs (the ideal output is B′, i.e. B with the same change applied). Answers go to Firebase
Firestore, and researchers read them on a results page with CSV/JSON export.

It is a static React app (Vite + Tailwind). It needs no server and can be hosted free on GitHub Pages.

## Pages

| Page | Where | What it does |
|---|---|---|
| Welcome | `src/pages/WelcomePage.jsx` | Explains the task with an A/A′/B/B′ example and a Start button |
| Consent | `src/pages/ConsentPage.jsx` | Consent checkbox. Turn it off with `consent.enabled` in `src/config/study.js` |
| Survey | `src/pages/SurveyPage.jsx` | One question per screen: reference images, optional edit chips, outputs in shuffled order, 1st/2nd/3rd buttons, progress bar, click-to-zoom |
| Thank you | `src/pages/ThankYouPage.jsx` | Saves the response. If saving fails, it offers Retry and a copyable JSON backup |
| Results | `…/#/results` → `src/pages/ResultsPage.jsx` | Researchers only (Google sign-in): per-method rank counts, Borda points, 1st/top-3 rates, winner per question, submissions list, CSV/JSON downloads |

Differences from the reference site:


- The survey keeps progress in the browser, so a refresh resumes where the participant left off.
- Each answer also records the order the outputs were shown in and the time spent on the question.
- A retry cannot create a duplicate, because the document id is the session id.
- There is a report page.

## 1. Run it locally

```bash
npm install
npm run dev          # http://localhost:5173 (answers go to Firebase, tagged as test runs)
npm run dev:local    # same, but answers stay in your browser and never reach Firebase
```

**On Windows without installing anything:** run `bash setup.sh` on a Linux/macOS machine (e.g. the server
this project lives on). It writes `build/pantomime-survey-windows.zip`, containing the project with Windows
builds of all packages plus a portable Node.js. Copy the zip to Windows, extract it to a short path such as
`C:\pantomime-survey`, and double-click `start-windows.bat` (or `start-windows-local.bat` for local mode).

Answers from `npm run dev` are saved with `study_id` = `pantomime-v1-dev`. The results page hides them unless
you tick "Include test runs", so testing never mixes with real data.

## 2. Add your questions

Each question is one folder in `public/images/`:

```
public/images/q01/
  img_a.png          A   (exemplar)
  img_a_prime.png    A′  (exemplar after the change)
  img_b.png          B   (new subject)
  PanToMime.png      one image per method; the file name is the method name used in the report
  Baseline1.png
  ...
  meta.json          optional: {"change": "camera orbits 30° to the left",
                                "applied_edits": ["jumping pose"], "skipped_edits": ["add a hat"]}
```

Then regenerate the question list:

```bash
npm run samples      # writes src/data/samples.json
```

- Questions are shown in folder-name order. To pick and order a subset, list the folder names one per line
  in `public/images/order.txt`.
- Delete the `demo_*` folders and replace `public/welcome/*` (the welcome-page example) with real images.
- **Blinding:** the page never shows method names, but the image URL does (`…/PanToMime.png`), exactly as on
  the reference site. If that matters to you, name the files with neutral codes (`m1.png`, `m2.png`, …) and
  keep the mapping yourself.
- All participant-facing text is in `src/config/study.js`: title, task description, consent text and number
  of ranks. When you change the questions after the study has started, change `id` there too, so responses
  from the two versions can be told apart.

## 3. Firebase (project `pantomime-baseline`)

The web config is in `src/config/firebase.js`. It is not a secret, because every visitor's browser receives it
anyway. `firestore.rules` is what protects the data: anyone may **submit** one response per session, only
admins may **read**, and nobody may edit or delete.

One-time setup:

1. **Publish the rules:** Firebase console → Firestore Database → **Rules** → replace everything with the
   contents of `firestore.rules` → **Publish**. (Or run `npx firebase-tools login` and then
   `npx firebase-tools deploy --only firestore:rules --project pantomime-baseline`.)
   Until you do this, submissions fail, because a new database denies all writes.
2. **Make yourself an admin:** open `…/#/results` and sign in with Google. The page shows your user ID and the
   four clicks needed to add it: collection `admins`, document ID = your user ID.
3. **Before sharing the public link:** Authentication → Settings → **Authorized domains** → add
   `<your-github-user>.github.io` (`localhost` is already allowed).

## 4. Publish on GitHub Pages

Run this on the machine that has the git repo (not from the Windows zip, which has no git):

```bash
npm run deploy       # builds the site and pushes only dist/ to the gh-pages branch
```

Your source code is not pushed; only the built site is. After the first deploy, one time only, in the GitHub
repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / `(root)` → Save**.
The study is then at `https://<your-github-user>.github.io/pantomime-survey/` (it takes about a minute).
Run `npm run deploy` again whenever you change questions or text.

## 5. Get the report

Open `https://<your-user>.github.io/pantomime-survey/#/results` and sign in with an admin Google account. It shows:

- **Methods, ranked by points:** how often each method was ranked 1st/2nd/3rd, Borda points
  (1st = 3, 2nd = 2, 3rd = 1), 1st-place rate and top-3 rate (both relative to how often the method was shown).
- **Most-preferred method per question.**
- **Submissions:** time and duration of each participant's session.
- **Export:**
  - `responses_<date>.csv`: one row per participant × question, with columns
    `session_id, study_id, submitted_at, sample_id, rank1, rank2, rank3, display_order, time_ms`.
  - `method_summary_<date>.csv`: the method table above.
  - `responses_<date>.json`: everything, raw.

Each Firestore document (`responses/<session_id>`) looks like:

```json
{
  "session_id": "fd85e11d-…",
  "study_id": "pantomime-v1",
  "submitted_at": "<server timestamp>",
  "started_at": 1790000000000,
  "total_time_ms": 512345,
  "user_agent": "Mozilla/5.0 …",
  "rankings": [
    { "sample_id": "q01", "rank1": "PanToMime", "rank2": "Baseline1", "rank3": "Baseline3",
      "display_order": ["Baseline3", "PanToMime", "Baseline1", "Baseline2", "Baseline4"], "time_ms": 23110 }
  ]
}
```

## Project layout

```
index.html
src/
  main.jsx, App.jsx        page flow (welcome → consent → survey → thank you) and #/results routing
  config/study.js          all study text and settings
  config/firebase.js       Firebase web config (local mode with `npm run dev:local`)
  data/samples.json        generated by `npm run samples`
  lib/responses.js         submit / fetch responses (Firestore or localStorage)
  lib/progress.js          resume-after-refresh
  lib/report.js            statistics and CSV export
  pages/                   one file per page
  components/              image with fallback, lightbox, edit chips, local-mode banner
public/images/             question folders (demo_* are placeholders)
public/welcome/            welcome-page example images
scripts/build_samples.py   folders → samples.json
scripts/make_demo_images.py placeholder images
firestore.rules            who may write and read responses
setup.sh                   builds a double-click Windows bundle (build/pantomime-survey-windows.zip)
```
