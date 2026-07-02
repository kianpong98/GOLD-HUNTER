Gold Hunter V10 Performance Notes

What changed:
- Results and reviews now load from manifest.json first for much faster first load.
- New images/videos added after the manifest are scanned in the background, not blocking the first screen.
- Result videos and Inside Gold Hunter videos are lazy-loaded and only play on hover/click.
- Video posters were generated for existing videos so the gallery shows a preview without downloading the full video immediately.
- Loader is shortened with a safety timeout.
- Images use lazy loading + async decoding where possible.

Adding results:
- Add files into assets/results/ using sequential names such as result-013.png or result-014.mp4.
- The site can find new sequential files in the background.
- For best speed, convert large screenshots to WebP/JPG and keep files under ~500KB when possible.

Adding reviews:
- Add files into assets/reviews/ as review-007.png, review-008.jpg, etc.

Adding inside media:
- Use assets/meeting.mp4 or meeting.png
- Use assets/analysis.mp4 or analysis.png
- Use assets/group.mp4 or group.png
- Use assets/indicator.mp4 or indicator.png

For best video speed:
- Keep videos 5-12 seconds.
- Export as MP4, 720p or 1080p, muted, under 5MB if possible.
