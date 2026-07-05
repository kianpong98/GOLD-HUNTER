Gold Hunter Stable Gallery Engine v18

What changed:
- Removed background re-render scan that could make gallery thumbnails disappear after a while.
- Results and Reviews now render once from manifest.json + a short one-time continuous scan.
- Homepage shows latest 6 Results and latest 6 Reviews.
- Show More opens a full Apple-style grid gallery.
- Tap any item to enter the swipe viewer.
- Swipe left/right, Back closes, down swipe closes, double tap/pinch zoom supported.

Important for updates:
- Best method: update manifest.json whenever adding new files.
- Results: assets/results/manifest.json
- Reviews: assets/reviews/manifest.json
- Newest items will be shown first automatically by number, e.g. result-013 before result-012.
- If you forget manifest, it will only scan continuous new files after the highest number already in manifest.
