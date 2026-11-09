# Pikachu Volleyball 2v2

English | [한국어](README.ko.md)

A local multiplayer fork of [gorisanson/pikachu-volleyball](https://github.com/gorisanson/pikachu-volleyball), adding four-player 2v2 matches while preserving the original game's movement and collision behavior.

GitHub Pages addresses after deployment: [English](https://ilesejin.github.io/pikachu-volleyball-2v2/en/) · [한국어](https://ilesejin.github.io/pikachu-volleyball-2v2/ko/).

## Game modes

English and Korean pages start in 2v2. Choose a match in the animated menu using jump/down, then press a hit key to confirm. Each directional press moves one row; a hit during the opening animation skips to selection.

| Mode                    | Left team                                 | Right team                              |
| ----------------------- | ----------------------------------------- | --------------------------------------- |
| 1 Player + 3 Computers   | Confirming key chooses the human position | The other three positions are computers |
| 2 Players + 2 Computers | Z: humans; Enter: computers | Z: computers; Enter: humans |
| 4 Players    | P1 + P2: human                            | P3 + P4: human                          |

In **1 Player + 3 Computers**, confirm with **Z → P1**, **V → P2**, **comma → P3**, or **Enter → P4**. P1/P2 always belong to the left team and P3/P4 to the right team. The starting order from left to right is **P1–P2–P3–P4**. P4 serves first on the right, followed by P3 when alternating.

Teammates can overlap and pass through each other. Computer teammates use front/back coverage. The animated menu background fills the configured court width.

Use **Game → Original 1v1** or **Game → 2v2** to switch formats. Original 1v1 supports human vs computer and human vs human. The Chinese page retains original 1v1. Leaving the menu idle starts an untimed computer demonstration.

## Controls

All humans play locally on one physical keyboard. Players have different tints. In **2 Players + 2 Computers**, confirm with **Z** for the left team (P1+P2) or **Enter** for the right team (P3+P4). The first local player uses **R/D/F/G/V/Z**, and the second uses **arrows/Enter**. In solo mode, both key sets control the selected Pikachu.

R jumps, D/G move left/right, and Z hits. By default **F = down+toward the net** (down-right on the left court, down-left on the right court), and **V = down**. **Options → 2v2 RDFGVZ F/V setting** can instead set **F = down, V = unused**. This preference is saved in this browser across visits and language changes; it applies only to 2v2 RDFGVZ. V still selects P2 in the solo menu.

For **4 Players**, use these slot-specific bindings:

| Player | Jump | Left | Down-right | Right       | Down            | Hit / confirm |
| ------ | ---- | ---- | ---------- | ----------- | --------------- | ------------- |
| P1     | W    | A    | S          | D           | X               | Z             |
| P2     | Y    | G    | H          | J           | B               | V             |
| P3     | P    | L    | —          | Quote (`'`) | Semicolon (`;`) | Comma (`,`)   |
| P4     | ↑    | ←    | —          | →           | ↓               | Enter         |

P3 uses the physical punctuation keys **without Shift**, even if the keyboard labels show `"`, `:`, or `<`. Jump, dive, and power-hit mechanics follow the original game. Power hit while jumping starts a smash; hit plus horizontal movement while standing starts a dive.

In original 1v1, the left player uses D/G to move, R to jump, V for down, F for down-right, and Z to hit. The right player uses arrows/Enter. In human vs computer, Z selects the left human and Enter selects the right human.

The menu order is **1 player → 2 players → 4 players**. Your speed selection is saved and retained across mode changes, match restarts, and reopening the site.

**Escape** toggles the menu bar. Pause, speed, sound, winning-score, and practice controls are available in the page menus. The About panel also lists the 2v2 controls.

## Court and serve settings

The default width is **340 units per side**, or **680 total**. In **Options → 2v2 width per side**, enter an integer of at least 216 and click Apply or press Enter.

Open **Options → 2v2 serve…** for these choices:

| Option                                                  | Player starting positions                                        | Ball starting position        |
| ------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| 1. Back ball; alternate player positions                | Teammates swap back/middle positions whenever their team serves. | Always at the back.           |
| 2. Fixed players; alternate ball position **(default)** | P1/P4 at the back, P2/P3 at the middle of their half.            | Alternates between teammates. |
| 3. Fixed players and ball                               | Same fixed player positions as option 2; P1/P4 always serve.     | Always at the back.           |

The ball spawns 20 units toward the net from its server. Each team tracks its serving sequence independently. AI coverage follows the players' starting positions.

Applying a different width or serve option restarts an active 2v2 match at 0–0 with the same human/computer lineup. Settings last for the current page session and are retained when switching formats. Changing them in original mode configures the next 2v2 match without changing 1v1.

To change initial defaults, edit [doubles_config.js](src/resources/js/doubles_config.js) and rebuild.

## Run locally

The tests require Node.js 18 or newer. This project was verified with Node.js 22.11.0. npm 8 or newer is recommended; a clean installation with npm 6 was also verified after making the required Pixi peer packages explicit dependencies.

```sh
git clone https://github.com/ilesejin/pikachu-volleyball-2v2.git
cd pikachu-volleyball-2v2
npm ci
npm start
```

Open the address printed by webpack, then use `/en/` or `/ko/` for the game.

| Command          | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `npm start`      | Start the development server.                                      |
| `npm run build`  | Create the production game in `dist/`.                             |
| `npm test`       | Run 23 regression checks, including original physics preservation. |
| `npm run deploy` | Build, then publish `dist/` to the `gh-pages` branch of `origin`.  |

To preview the production build locally:

```sh
npm run build
npx http-server dist
```

The browser control/persistence checks can be run after a development build: `npx webpack --config webpack.dev.js`, then `npm run test:browser`. They require Chrome and Node.js 22.

## Deploy to GitHub Pages

The current deployment script is `gh-pages -d dist`. Its `predeploy` script runs `npm run build` automatically. The deployment target follows the Git remote named `origin`, so check it before publishing:

```sh
git remote get-url --push origin
```

For this fork it should be `https://github.com/ilesejin/pikachu-volleyball-2v2.git`. Then publish using a Git account with write access:

```sh
npm run deploy
```

In the repository's **Settings → Pages**, choose **Deploy from a branch**, branch **gh-pages**, folder **/ (root)**, and Save. After GitHub finishes publishing, the site address is [ilesejin.github.io/pikachu-volleyball-2v2/](https://ilesejin.github.io/pikachu-volleyball-2v2/). The root page redirects to `/en/`; Korean is available at `/ko/`.

This command publishes the built website. Keep source changes in the repository's development branch separately.

## Dependency troubleshooting

If webpack cannot resolve `@pixi/utils`, `@pixi/math`, `@pixi/runner`, `@pixi/graphics`, or `@pixi/text`, update your checkout and run `npm ci` again. These packages are now explicit dependencies pinned to **6.4.2**, so npm 6 also installs them. Keep `package-lock.json` with the project.

Webpack may report bundle-size recommendations and an outdated Browserslist database notice. These are separate from missing-module errors. Workbox's precache limit is 8 MiB so the larger development vendor bundle is included.

## Code and preserved physics

| File                                                      | Responsibility                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [physics.js](src/resources/js/physics.js)                 | Original 1v1 physics and AI, unchanged.                                        |
| [doubles_physics.js](src/resources/js/doubles_physics.js) | Separate 2v2 adaptation, per-match geometry, serve setup, and coverage inputs. |
| [doubles_config.js](src/resources/js/doubles_config.js)   | Initial court width, serve mode, and player tints.                             |
| [pikavolley.js](src/resources/js/pikavolley.js)           | Modes, input polling, scoring, rounds, and match restarts.                     |
| [view.js](src/resources/js/view.js)                       | PixiJS rendering and animated menus.                                           |
| [ui.js](src/resources/js/ui.js)                           | Page menus and settings panels.                                                |

The original wall asymmetry, contact tests, response formulas, prediction quirks, and ball-rotation glitch are intentionally preserved. See [GAME_BEHAVIOR.md](GAME_BEHAVIOR.md) for the architecture, exact controls, physics observations, and verification details.

## Credits

The original 1997 Windows game was developed by **SACHI SOFT / SAWAYAKAN Programmers** and **Satoshi Takenouchi**. **Kyutae Lee (gorisanson)** reverse-engineered its core physics and AI and implemented the upstream JavaScript version. This fork adds the local 2v2 features described above.

The upstream reverse-engineering work used [Ghidra](https://ghidra-sre.org/), [Cheat Engine](https://www.cheatengine.org/), [OllyDbg](http://www.ollydbg.de/), and [Resource Hacker](http://www.angusj.com/resourcehacker/). Rendering uses [PixiJS](https://github.com/pixijs/pixijs).

Automated browser tests launch Chrome with audio muted.
