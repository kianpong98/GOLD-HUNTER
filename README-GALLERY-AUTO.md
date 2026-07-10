# Gold Hunter Auto Gallery

## Add a new Result
1. Upload your file into `assets/results/`.
2. Use a filename like `result-013.png`, `result-014.mp4`, or `result-015.webp`.
3. Commit the change.
4. GitHub Actions will automatically update `assets/results/manifest.json`.
5. Cloudflare Pages will deploy the updated gallery.

For videos, you may also add a poster image with the same number:

```text
assets/results/result-014.mp4
assets/results/result-014-poster.jpg
```

## Add a new Review
1. Upload your file into `assets/reviews/`.
2. Use a filename like `review-011.png`, `review-012.jpeg`, or `review-013.webp`.
3. Commit the change.
4. GitHub Actions will automatically update `assets/reviews/manifest.json`.

## Important
The site reads the `manifest.json` files. If new media does not show, check GitHub → Actions. The workflow must show green Success.

If GitHub Actions cannot commit, go to:

Settings → Actions → General → Workflow permissions → Read and write permissions → Save.
