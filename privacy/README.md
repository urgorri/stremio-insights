# Stremio Insights Privacy Policy Website

This directory contains the source code for the official, production-ready Privacy Policy website of the **Stremio Insights** Chrome Extension. It is fully self-contained, lightweight, responsive, accessible, and designed to be deployed instantly through GitHub Pages.

## Purpose

To be listed on the Google Chrome Web Store, extensions must provide a public Privacy Policy URL that discloses data practices.
This page satisfies Chrome Web Store policies by clearly detailing:
- What data the extension processes (Stremio session keys, playback logs, IMDb IDs, metadata).
- Why this data is handled strictly locally in the browser (`chrome.storage.local`).
- That **no user data is collected or sent to remote servers**.
- User controls (such as exporting to CSV/JSON or permanently deleting all history).

## Contents

- `index.html`: Semantic, responsive layout with clear headings, Open Graph metadata, Table of Contents, and full technical disclosures.
- `styles.css`: Pure, framework-free, lightweight CSS styling featuring high contrast and robust accessibility.
- `favicon.png`: Transparent high-resolution icon matching the extension's branding.
- `robots.txt`: Simple instructions permitting search engines to crawl and index the privacy document.

## Deployment Instructions (GitHub Pages)

You can host this Privacy Policy completely free using GitHub Pages directly from your project repository.

### Step 1: Push Changes to GitHub
Commit and push this `/privacy` directory to your main/master branch on GitHub:
```bash
git add privacy/
git commit -m "docs: add production-ready privacy policy website"
git push origin main
```

### Step 2: Configure GitHub Pages
1. Go to your repository on GitHub.
2. Click on the **Settings** tab at the top right.
3. In the left-hand sidebar, navigate to the **Pages** section (under *Code and automation*).
4. Under **Build and deployment**:
   - Set **Source** to `Deploy from a branch`.
   - Under **Branch**, select `main` (or whichever branch you pushed to) and choose the `/ (root)` folder.
   - Click **Save**.

### Step 3: Verify Deployment
GitHub will automatically compile and launch your site. Within 1-2 minutes, your Privacy Policy website will be live.

## Resulting URL

Once deployed, the Privacy Policy will be accessible at:

**`https://<username>.github.io/<repository>/privacy/`**

*Replace `<username>` with your GitHub username/organization, and `<repository>` with the name of your GitHub repository (e.g., `https://myusername.github.io/stremio-insights/privacy/`).*

## Local Testing

To preview the Privacy Policy website locally, run a local web server from this directory:
```bash
# Using Python
cd privacy && python3 -m http.server 8000

# Using Node.js (npx)
npx serve privacy/
```
Then open `http://localhost:8000` in your web browser.
