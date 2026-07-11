## Run Locally

**Prerequisites:**  Node.js



1. Install dependencies:
`npm install`
2. Run the app:
`npm run dev`


## Deploy to GitHub Pages

This project must be deployed from the GitHub Actions artifact, not directly
from the repository root.

1. In GitHub, open `Settings > Pages`.
2. Set `Build and deployment > Source` to `GitHub Actions`.
3. Push to `main`; `.github/workflows/deploy.yml` builds the app and publishes
   the `dist` folder.

If Pages serves the repository root instead of `dist`, the browser will try to
load `src/main.tsx` directly and fail with a module MIME type error.
