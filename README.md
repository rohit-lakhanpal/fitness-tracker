# Fitness Tracker (Client-Side / GitHub Pages)

Mobile‑friendly, entirely client‑side fitness workout tracker designed to run from GitHub Pages and store all workout data locally in your browser (localStorage). No backend required.

## Features

* Three predefined workouts (customizable in `script.js`).
* Add sets (weight + reps + optional notes) per exercise.
* Automatic local persistence (localStorage) – your data stays on your device.
* Auto-save of in-progress sessions (debounced) once you begin entering data.
* Session history per workout (view & load past sessions; clone into a new session).
* Export all data to a downloadable JSON file.
* Import previously exported JSON to restore or merge data.
* Offline capable (Progressive Web App) via service worker + manifest.
* Mobile friendly responsive layout (installable to home screen on iOS/Android supporting PWA).

## Data Model (Stored in `localStorage` under key `ft_data`)
```
{
	version: 1,
	workouts: { <workoutKey>: { name, exercises: [ { name } ] }, ... },
	sessions: [
		{
			id: string,            // uuid
			date: string,          // ISO timestamp
			workoutKey: string,    // matches workouts key
			exercises: [
				{ name: string, sets: [ { n: number, weight: number, reps: number, notes?: string } ] }
			]
		}
	]
}
```

## Quick Start (Local Preview)

Simply open `index.html` in a browser (double‑click). For full PWA + service worker behavior (especially on Chrome), serve via a local static server (optional):

```
npx serve .
```

Then open the printed URL (e.g. http://localhost:3000) on your phone (same network) for quick mobile testing.

## Export & Import

* Export: Click Export > downloads `fitness-tracker-export-YYYYMMDD.json`.
* Import: Use the Import button and select a JSON export. You can choose Merge (preserves existing & adds new sessions) or Replace (overwrites everything).

## Enable GitHub Pages

1. Commit & push these files to the `main` (or `master`) branch.
2. In your GitHub repo: Settings > Pages.
3. Build & deployment: Source = Deploy from a branch. Branch = `main` / root.
4. Save. Wait for deployment (badge turns green). Your site will be at:
	 `https://<username>.github.io/<repo>/`.
5. (Optional) Add the URL to the repo About section.

## PWA Install

After first load, the service worker caches assets for offline use. On supported browsers you can "Add to Home Screen" to launch it like a native app.

## Customizing Workouts

Workouts live in `DEFAULT_WORKOUTS` inside `script.js`.

Each workout entry shape:
```
workoutKey: {
	name: 'Readable Name',
	exercises: [
		'Exercise Name',
		{ name: 'Exercise With Plan', plan: ['8-12','8-12','5-8','5-8'] }
	]
}
```
`plan` is an optional array of rep targets / ranges displayed as small badges for reference only (it does not limit set inputs).

If an exercise has a `plan`, the app now automatically pre-creates that many rows (sets) with a Target column showing each planned rep range. You can add or remove sets freely; targets are just reference text.

Current default set matches the three trainer sessions you provided (Push, Lower, Pull). Rename keys or modify exercises as needed, then refresh; existing saved data remains unless you clear storage / import new data.

## Roadmap Ideas

* Dark mode toggle.
* Data visualization (volume over time, PR tracking).
* Custom workout creation UI.
* CSV export.

## License

MIT

