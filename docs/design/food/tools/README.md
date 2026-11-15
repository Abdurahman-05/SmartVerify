# Menu photos: how to continue

Dish photos for the starter menu are made in **Stitch** (project "Gebtual Menu Photos") from the
prompts in `docs/design/flow/batch-NN-prompts.txt`, then added to the app and to a test menu.

## Where things are

| What | Where |
| --- | --- |
| Prompts, one per line, 6 batches | `docs/design/flow/batch-NN-prompts.txt` (+ `batch-NN-filenames.txt`, same order) |
| Full-size photos (1024 px), one folder per dish | `docs/design/food/stitch_gebtual_menu_photos/<dish_key>/screen.jpg` |
| Photos inside the app (320 px) | `frontend/assets/images/menu/<dish_key>.jpg` |
| Photo lookup used by the app | `frontend/src/lib/menuPhotos.ts` (catalog key → image) |

Folder names are the menu's catalog keys with `_` instead of `-` (`doro_wat` = `doro-wat`). An item
shows its photo when it was added from a starter pack (its `catalogKey` matches).

## Status (15 Nov 2026)

- Batch 01: done except the dishes not generated yet (run the script to see what is left).
- Batch 02: done, all on the test menu.
- Batch 03: Misir Wat, Atkilt Wat, Gomen Besiga, Fish Goulash, Fish Cutlet, Fried Fish, Egg Firfir
  done and on the test menu. The rest not started (run the script to see what is left).
- Batches 04–06: not started.

## Steps (from the repo root)

1. **Generate** the next dishes without a photo (about 3 min each; skips dishes that have one):

   ```bash
   node docs/design/food/tools/generate-photos.js 02 11
   ```

   It needs the Stitch key saved in Claude's settings (`~/.claude.json`, Stitch MCP server for this
   project). "fetch failed" = the internet dropped: just run it again.

2. **Shrink into the app** (replace the old copies, then rebuild the lookup):

   ```powershell
   Remove-Item frontend/assets/images/menu/*.jpg
   powershell -ExecutionPolicy Bypass -File docs/design/food/tools/resize-photos.ps1 `
     -Src docs/design/food/stitch_gebtual_menu_photos -Dst frontend/assets/images/menu
   ```

   Then regenerate `frontend/src/lib/menuPhotos.ts` with one line per `.jpg`
   (`'doro-wat': require('../../assets/images/menu/doro_wat.jpg') as number,`) and run
   `npm run typecheck` in `frontend/`.

3. **Add the dishes to the test menu** (local dev database, account +251 909 080 706, business
   "Abd"): call `createMenuService(prisma).importCatalog(auth, { items: [{ key: 'doro-wat' }, …] })`
   from a short `tsx` script in `backend/` (same as the Menu screen's "add from starter pack"; items
   already on the menu are skipped). Prices are the starter pack's.
