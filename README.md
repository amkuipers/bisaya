# Bisaya Buddy 🌺

A translation helper and tutor for **Nederlands · English · Cebuano (Bisaya)**, made for children aged 3–12.
It's a static site with no server and no build step, so it runs on GitHub Pages and works offline once loaded.

## Features
- **Translate:** uses an offline phrasebook. It matches whole phrases first, then word by word, and suggests similar phrases. Full sentences can be opened in Google Translate.
- **Learn:** 5 age levels (3–4, 5–6, 7–8, 9–10, 11–12) with 24 topics. Each topic has flashcards (swipe or tap to hear), a word list and a quiz.
  Ages 3–6 get picture quizzes you listen to (no reading needed). Older levels mix *how do you say*, *what does it mean* and *what do you hear* questions.
  Stars are saved in the browser.
- **Text to speech:** uses the Web Speech API. Most devices have no Cebuano voice, so a Filipino or Indonesian voice is used as an approximation. Settings shows which voices are available.
- **Phone-friendly:** installable (Add to Home Screen), light and dark mode.

## Run locally
```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Publish on GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages → Build and deployment**, choose *Deploy from a branch*, select `main` and `/ (root)`.
3. The app will be at `https://<user>.github.io/<repo>/`.

## Adding words
All content is in `js/data.js`. Each item is `[emoji, english, dutch, cebuano]`. Use `|` to add alternatives
(`'Hello|Hi'`). The first form is shown, and every form is used by the translator.
After changing files, bump `VERSION` in `sw.js` so installed copies update.

> The Cebuano content uses common everyday Bisaya. Have a native speaker review it, especially regional variants.
