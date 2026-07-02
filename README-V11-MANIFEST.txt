Gold Hunter V11 Manifest Gallery

This version uses manifest.json as the source of truth for Results and Reviews.
Current counts:
- Results: 12
- Reviews: 10

To add a new result:
1. Put the file in assets/results/
   Example: result-013.png or result-013.mp4
2. Add it to assets/results/manifest.json

To add a new review:
1. Put the file in assets/reviews/
   Example: review-011.png
2. Add it to assets/reviews/manifest.json

Supported result formats: png, jpg, jpeg, webp, gif, avif, mp4, webm, mov.
Supported review formats: png, jpg, jpeg, webp, gif, avif.

This avoids false counts like 90 items when only 12 files exist.
