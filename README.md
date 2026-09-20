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

### Live preview on this Vast instance

`supervisorctl status pantomime-survey` runs the Vite dev server on `127.0.0.1:15173`, published by
Caddy on external port 10100. Open the URL that `vast-capabilities` reports for **PanToMime Survey**
(or `http://$PUBLIC_IPADDR:$VAST_TCP_PORT_10100/?token=$OPEN_BUTTON_TOKEN`) and the page hot-reloads
as soon as any file here changes — no rebuild, no restart. `HMR_CLIENT_PORT` in
`/opt/supervisor-scripts/pantomime-survey.sh` is what makes the reload websocket survive the proxy.

```bash
supervisorctl restart pantomime-survey    # only needed if the server itself dies
tail -f /var/log/portal/pantomime-survey.log
```

Answers from `npm run dev` are saved with `study_id` = `pantomime-v1-dev`. The results page hides them unless
you tick "Include test runs", so testing never mixes with real data.

## 2. The questions

The 20 questions in `public/images/Questions/` are built from the ablation eval pairs by
`scripts/build_questions_from_evals.py`. Edit its `SELECTION` list (one `eval<N>` key per question,
in the order participants see them) and re-run it:

```bash
python3 scripts/build_questions_from_evals.py --dry-run   # show what it would write
python3 scripts/build_questions_from_evals.py             # rewrite q1..qN
npm run samples                                           # then regenerate samples.json
```

It copies A, A' and B from the dataset and one output per method from `/workspace/ablation_results`,
and writes each `meta.json` from the pair's own camera delta and prompts. B' (the ground truth) is
never copied: the participant is asked to imagine it.

The current 20 were hand-picked from the pairs the authors reviewed, for a large A → A' camera move
(17 of the 20 turn at least 90°) and a wide spread of prompts (all 13 reviewed prompt groups appear),
then ordered so no two neighbouring questions share a prompt.

Two files it also writes, both outside `public/` so participants never receive them:

| File | What it holds |
|---|---|
| `scripts/method_blinding.json` | which baseline each `Method_X` code is — the key to the report |
| `scripts/question_sources.json` | per question: the eval key, the four dataset paths (B' included), both cameras, and the generated meta |

`meta.json` is derived, not typed by hand. Its conventions, verified against the dataset:

- **azimuth** passes through unchanged; negative means the camera orbits **right** in both the dataset
  and `src/lib/camera.js`.
- **elevation** passes through unchanged; positive moves **up**.
- **zoom** comes from the dataset's `distance` *label* (1 = medium shot, 3 = wide shot). On controlled
  pairs — same azimuth and elevation, distance 1 vs 3 — the subject changes by about 2×, so 1 → 3 is
  `0.5` (zoom out) and 3 → 1 is `2` (zoom in).
- Azimuth deltas are wrapped into (−180°, 180°]: the index stores A' minus A literally, so an orbit
  from +90° to −135° is recorded as −225° where the camera actually travelled +135°.

## 2b. Add your own questions by hand

Each question is one folder in `public/images/Questions/`, named `q1`, `q2`, `q3`, …:

```
public/images/Questions/q1/
  img_a.png          A   (exemplar)
  img_a_prime.png    A′  (exemplar after the change)
  img_b.png          B   (new subject)
  PanToMime.png      one image per method; the file name is the method name used in the report
  Baseline1.png
  ...
  meta.json          optional, see below
```

`meta.json` describes what changed from A to A′. The survey shows it under the reference images, with an
icon for each camera move:

```json
{
  "camera": { "azimuth": -40, "elevation": 10, "zoom": 1.2 },
  "edit1": "jumping",
  "edit2": "sunglasses"
}
```

| Key | Meaning |
|---|---|
| `camera.azimuth` | degrees; negative = the camera orbits **right**, positive = **left** |
| `camera.elevation` | degrees; positive = the camera moves **up**, negative = **down** |
| `camera.zoom` | factor; `1` = unchanged, above 1 = zoom **in** (`1.5`), below 1 = zoom **out** (`0.8`) |
| `edit1`, `edit2`, … | the edits, shown in number order |

Every key is optional. A camera value left out means "no change" (`0`, `0`, `1`), and only the moves that
change get an icon. The camera keys may also be written at the top level instead of inside `"camera"`.

Then regenerate the question list:

```bash
npm run samples      # writes src/data/samples.json
```

- Questions are shown in number order (`q2` before `q10`). To pick and order a subset, list the folder names
  one per line in `public/images/Questions/order.txt`.
- The script stops with a message if a meta.json value is invalid, and warns about keys it doesn't know
  (a typo such as `elevaton`).
- **Blinding:** the page never shows method names, but the image URL does, exactly as on the reference site.
  That is why the generated questions use neutral codes (`Method_A.png`, …) with the key in
  `scripts/method_blinding.json`. Keep that shape if you add folders by hand.
- All participant-facing text is in `src/config/study.js`: title, task description, welcome example and number
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
  main.jsx, App.jsx        page flow (welcome → survey → thank you) and #/results routing
  config/study.js          all study text and settings
  config/firebase.js       Firebase web config (local mode with `npm run dev:local`)
  data/samples.json        generated by `npm run samples`
  lib/responses.js         submit / fetch responses (Firestore or localStorage)
  lib/progress.js          resume-after-refresh
  lib/report.js            statistics and CSV export
  pages/                   one file per page
  components/              image with fallback, lightbox, arrows, edit/camera icons and panel, local-mode banner
public/images/Questions/   question folders q1, q2, … (the current ones are placeholders)
public/welcome/            welcome-page example images
scripts/build_questions_from_evals.py  eval pairs → question folders (+ the blinding key)
scripts/build_samples.py   folders → samples.json
scripts/make_demo_images.py placeholder images
firestore.rules            who may write and read responses
setup.sh                   builds a double-click Windows bundle (build/pantomime-survey-windows.zip)
```
