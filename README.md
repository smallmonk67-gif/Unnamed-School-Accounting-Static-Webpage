[![logo.jpg](https://i.postimg.cc/J42R2rDJ/logo.jpg)](https://postimg.cc/rK56dL9F)

# Unnamed School Accounting Static Webpage
## a Music School Accounting & Scheduling Webpage

A **100% client-side, zero-backend** accounting, tuition ledger, and lesson scheduling web application designed for music schools, optimized to be hosted on **GitHub Pages**.

Built with **React**, **SQLite WASM** backed by the browser's **Origin Private File System (OPFS)**, **Google Drive OAuth2 Sync**, and **SheetJS Excel Export**.

---

## ✨ Features

1. **Teacher Categories & Monthly Rate Templates**
   - Categorized by **Music Instrument** and **Certificate/Qualification level** (e.g., *Senior Piano Specialist (Trinity ATCL)*, *Junior Strings Instructor*).
   - Distinct **student fees** and **teacher payouts** configured by **Lesson Grade** (Beginner, Grade 1 to 8, Diploma) and **Duration** (30, 45, 60 minutes).
   - Teachers can teach multiple instruments with different certificates and categories per instrument.

2. **Person Registrations (IC Identification)**
   - Both Teachers and Students are registered with **IC / National ID Number**, **Full Legal Name**, and **Birthday** (with calculated age display).
   - Optional **Preferred Name** / nickname support.
   - UUID primary keys ensure historical integrity if person details are updated.

3. **Weekly Scheduled Monthly Lessons & Rate Inheritance**
   - Students can be scheduled for multiple weekly recurring lessons with different teachers across a calendar month (assumed up to 4 times/month).
   - Lesson fees automatically resolve from the teacher's category rate template for that instrument and grade.
   - **Customized Rate Overrides**: Supports special negotiated rates assigned to a specific *(Student, Teacher, Instrument, Duration)* combination.
   - Rates persist automatically month-over-month until modified.

4. **Adhoc Lesson Sessions**
   - Schedule one-off trial, exam preparation, or masterclass lessons.
   - Custom session date, start time, student fee, and teacher remuneration.

5. **Student Fee Payments & Invoicing**
   - Record student payments for monthly recurring lessons, adhoc sessions, or miscellaneous fees.
   - **Historical Accuracy**: Stores the **exact snapshot amount paid** at transaction time rather than dynamic links, preserving accounting integrity across future rate changes.
   - Official printable student receipt generator (`RCP-XXXXXX`).

6. **Teacher Payroll & Salary Disbursements**
   - Record salary payouts to teachers for monthly lessons and adhoc sessions.
   - Automated expected monthly earnings calculator helper based on assigned recurring lesson slots.
   - Official printable salary voucher generator (`VCH-XXXXXX`).

7. **Interactive Timetable & Visualizer**
   - Weekly matrix timetable (Monday to Sunday) displaying lesson slots, start times, durations, instruments, and fees.
   - Filter by **Teacher**, by **Student**, or view all active sessions.
   - Direct click-to-edit action to modify schedules or reassign slots.

8. **Multi-Sheet Excel Export (`.xlsx`)**
   - Uses **SheetJS (`xlsx`)** to generate a formatted workbook containing:
     - *Sheet 1*: Students Directory & Profiles
     - *Sheet 2*: Teachers Directory & Faculty Info
     - *Sheet 3*: Teacher Instrument Qualifications & Categories
     - *Sheet 4*: Weekly Scheduled Lessons
     - *Sheet 5*: Adhoc Lesson Sessions
     - *Sheet 6*: Student Payments Ledger (Snapshot Amounts)
     - *Sheet 7*: Teacher Salaries Ledger (Snapshot Amounts)
     - *Sheet 8*: Rate Templates Matrix
     - *Sheet 9*: Customized Rate Overrides

---

## 💾 Storage & Google Drive Cloud Synchronization

### 1. Browser Origin Private File System (OPFS)
- Runs real **SQLite 3 WASM** in a dedicated background Web Worker.
- Saves the database directly into the browser's sandboxed OPFS as `ACCDB.sqlite`.
- Includes `coi-serviceworker` to transparently provide COOP/COEP isolation headers on static hosts like GitHub Pages.
- **"Save" Button**: Flushes pending SQLite transactions and saves state immediately to OPFS.

### 2. Google Drive OAuth2 Sync
- Direct client-side integration using **Google Identity Services (GIS)** token client with the narrow `drive.file` scope.
- **"Save & Sync" Button**: Saves to local OPFS, queries Google Drive for `ACCDB.sqlite`, and uploads or updates the file.
- **Daily Freshness Check**: On the first webpage launch each day, checks if the remote Google Drive file is newer than local OPFS. If newer, prompts the user with an option to replace local with remote.
- **Manual Pull**: Accessible anytime from the *Sync & Backup* tab to replace local with remote.

### 3. Multi-Device Conflict Resolution
When two devices make unsynchronized edits:
1. **Best-Effort Merge (Recommended)**:
   - Downloads remote `ACCDB.sqlite` into a temporary OPFS file (`remote.sqlite`).
   - Executes SQLite `ATTACH DATABASE 'remote.sqlite' AS remote_db;`.
   - Compares row `updated_at` timestamps across all tables, applies newer rows, honors soft-deletes (`deleted_at`), detaches `remote_db`, and uploads the unified database back to Google Drive.
2. **Keep Remote**: Replaces local database with the Google Drive copy.
3. **Force Overwrite Remote**: Overwrites the remote file with local database.

---

## 🚀 Deployment to GitHub Pages

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build static bundle**:
   ```bash
   npm run build
   ```
   The production-ready static files are generated in the `dist/` directory.

3. **Deploy to GitHub Pages**:
   - Push your code to GitHub.
   - In your repository settings under **Settings > Pages**:
     - Select **GitHub Actions** or deploy from the `dist` folder / `gh-pages` branch.
   - The application is configured with relative paths (`base: './'`), so it functions properly whether hosted at `https://<username>.github.io/<repository>/` or a custom root domain.

---

## 🔑 Google Cloud OAuth 2.0 Setup

To enable Google Drive sync:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable the **Google Drive API**.
3. Under **OAuth consent screen**, choose External, add your app name and user support email. Add the `.../auth/drive.file` scope.
4. Under **Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for local development)
     - `https://<username>.github.io` (for your GitHub Pages domain)
5. Copy the **Client ID** and paste it into the **Sync & Backup** tab of the web application.

---

## 🛠️ Development

Run the local Vite dev server:
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.
