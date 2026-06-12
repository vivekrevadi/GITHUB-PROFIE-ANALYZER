# Gexplorer - GitHub Profile Analyzer

Gexplorer is a premium, high-fidelity Single Page Application (SPA) designed to analyze and compare GitHub profiles. It parses public metadata to calculate a developer's rank, unlocks achievement badges, displays primary programming stack distributions, and offers side-by-side comparison tools.

![Gexplorer Dashboard](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png)

## Features

- **Profile Overview**: Displays developer details including avatar, bio, location, company, and website.
- **Developer Level (Rank)**: Computes a gamified developer level (`S`, `A`, `B`, `C`, `D`, `E`) using weighted formulas.
- **Rank Explanation**: Breaks the score into followers, stars, forks, and repository factors.
- **Key Metrics Grid**: Shows aggregated metrics such as total stars, total forks, public repository count, and followers.
- **Live Feed & Achievements**: Shows profile analysis events, API status, and unlocked badges such as *Polyglot Polymath*, *Star Collector*, and *Open Source Veteran*.
- **Language Charting**: Renders interactive programming language distributions using Chart.js.
- **Side-by-Side Comparison**: Compares two developers' metrics side-by-side, highlights winning stats, and summarizes the comparison.
- **API Status & PAT Support**: Tracks current GitHub API rate limits and supports adding Personal Access Tokens stored locally to increase limits.

## Technology Stack

- **Structure**: HTML5
- **Styles**: Custom vanilla CSS with a modern responsive dashboard layout
- **Logic**: Vanilla ES6 JavaScript with Fetch API, local in-memory caching, and client-side scoring
- **Charts**: Chart.js
- **Icons**: Lucide Icons

## How to Run Locally

Since Gexplorer is a static web application, you can run it in three ways:

### Option 1: Double-Click

Open File Explorer, navigate to the folder, and double-click `index.html` to run it in your browser.

### Option 2: Python HTTP Server

Run the following command in the project directory:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` in your web browser.

### Option 3: Local Dev Server (Vite)

Install Vite dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```
