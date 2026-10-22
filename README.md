# The Great Bridge Robbery

A bedtime story in eleven nights for Oscar and Samuel, from Daddy in San Francisco.
One chapter opens each night at midnight UK time, from Thursday 22 October to Sunday 1 November 2026.

- **Oscar's book**: about 5 minutes of reading to yourself, with a map of San Francisco each day.
- **Samuel's book**: the same story, 1–2 minutes read aloud.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository (it's a plain static site, with no build step).
2. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or so.

## Grown-ups' corner

Press and hold the little key at the very bottom of the page for about 1.5 seconds. From there you can open every chapter on that device (to read ahead or catch up), go back to one chapter a night, or clear the reading stars.

A chapter gets its star as soon as it is opened. Stars are saved in a cookie (and localStorage) on each device, and they never stop anyone reading the next chapter.

## Files

- `index.html`, `style.css`, `app.js`: the site
- `chapters.js`: the story text (both editions) and puzzles
- `images/`: the watercolour plates (`plate-NN.jpg`), Oscar's maps (`map-NN.jpg`) and the cover
- `tools/`: how the pictures were made. `paint.js` draws each scene as SVG, `render.js` rasterises it with Playwright, and `post.py` adds the watercolour finish. `BIBLE.md` is the story outline.
