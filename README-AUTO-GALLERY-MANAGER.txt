# Gold Hunter Auto Gallery Manager + Apple Gallery

## What this version includes

- Results homepage shows latest 6 items.
- Reviews homepage shows latest 6 items.
- Show More opens an Apple Photos-style grid with all items.
- Tap any item to open the swipe viewer.
- Supports images and videos.
- GitHub Actions automatically updates:
  - `assets/results/manifest.json`
  - `assets/reviews/manifest.json`
  - `assets/inside-manifest.json`

## How to add Result

1. Upload file into `assets/results/`
2. Name it:
   - `result-013.png`
   - `result-014.jpg`
   - `result-015.mp4`
3. Commit changes to GitHub.
4. GitHub Actions will update the manifest.
5. Cloudflare Pages will deploy automatically.

## How to add Review

1. Upload file into `assets/reviews/`
2. Name it:
   - `review-011.png`
   - `review-012.jpg`
3. Commit changes.

## Important

Do not manually create fake numbers in the website.
The count comes from `manifest.json`.
Latest numbers appear first.
