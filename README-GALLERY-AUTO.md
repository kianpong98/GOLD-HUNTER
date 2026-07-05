# Gold Hunter Gallery Auto Update

## How to add a new Result
1. Upload the file into `assets/results/`.
2. Use this naming style:
   - `result-013.png`
   - `result-014.jpg`
   - `result-015.mp4`
3. Commit the change.
4. GitHub Actions will automatically update `assets/results/manifest.json`.
5. Cloudflare Pages will deploy the updated site.

For videos, optional poster image:
- `result-015.mp4`
- `result-015-poster.jpg`

## How to add a new Review
1. Upload the file into `assets/reviews/`.
2. Use this naming style:
   - `review-011.png`
   - `review-012.jpg`
3. Commit the change.
4. GitHub Actions will automatically update `assets/reviews/manifest.json`.

Latest numbered files show first on the homepage.
