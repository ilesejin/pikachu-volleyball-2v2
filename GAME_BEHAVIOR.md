# Existing Pikachu Volleyball: code and physics guide

This document describes the original 1v1 implementation reviewed before adding 2v2. Observations below come from the source; suspected defects are documented, not corrected. The sections through Computer behavior record that baseline; the final section describes the implemented 2v2 extension.

## Running the project

This is a browser game written in JavaScript, rendered with PixiJS, and bundled with webpack. Install dependencies with `npm ci`, then use `npm start` for development or `npm run build` for production output in `dist`. The existing README suggests Node 16/npm 8 if installation fails. At initial review, `npm test` deliberately exited with an error. The extension now supplies preservation and 2v2 regression tests, run with `npm test` (Node 18 or newer).

The build generates English, Korean, and Chinese pages from `src/en`, `src/ko`, and `src/zh`. Korean setup replaces selected message textures before the game is constructed. Sprites, messages, and sounds are existing assets, not generated text in the canvas.

## Code map

| File                                 | Responsibility                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/resources/js/main.js`           | Registers Pixi plugins, creates a 432 by 304 canvas, loads assets, constructs the game, and runs its ticker. Canvas rendering is explicitly selected.                               |
| `src/resources/js/pikavolley.js`     | Game controller: keyboard polling, menu, state transitions, scoring, serving side, resets, sound effects, practice mode, and restart.                                               |
| `src/resources/js/physics.js`        | Ball and player state, movement, world collisions, player-ball collisions, landing predictions, and computer decisions.                                                             |
| `src/resources/js/view.js`           | Intro/menu/game views, player animations, background, scoreboard, shadows, ball trail, messages, fades, and decorative effects. Drawing the punch effect also decreases its radius. |
| `src/resources/js/keyboard.js`       | Keyboard listeners and per-frame input snapshots.                                                                                                                                   |
| `src/resources/js/audio.js`          | Sound loading/playback and volume controls. The controller selects left/center/right sound placement.                                                                               |
| `src/resources/js/cloud_and_wave.js` | Decorative cloud and wave motion.                                                                                                                                                   |
| `src/resources/js/rand.js`           | Integer random numbers from 0 through 32767, using Math.random by default; a custom RNG can be supplied.                                                                            |
| `src/resources/js/ui.js`             | HTML menus, pause/resume, options, restart, practice controls, and stored preferences.                                                                                              |
| `src/resources/js/assets_path.js`    | Sound and sprite texture paths.                                                                                                                                                     |
| `src/resources/style.css`            | Page layout, canvas scaling, and original 432:304 aspect ratio.                                                                                                                     |
| `webpack.common.js`                  | Shared bundling, localized HTML, asset copying, and service worker generation.                                                                                                      |

## Existing modes and controls

The animated menu offers With Computer and With Friend. With Friend makes both players human. With Computer makes the player who confirms the selection human, so the human can play either side. If no menu input arrives for 225 menu frames, both players become computers for an untimed demonstration. A power-hit key during this demonstration returns to the intro.

| Action                                | Left player | Right player        |
| ------------------------------------- | ----------- | ------------------- |
| Move left / right                     | D / G       | Left / Right arrows |
| Jump / down direction                 | R / V       | Up / Down arrows    |
| Power hit, dive, or menu confirmation | Z           | Enter               |
| Combined down and right               | F           | None                |

Input represents horizontal direction, vertical direction, and a power-hit press. Left has priority over right; up has priority over down. Power hit is edge-triggered: holding its key does not repeatedly trigger it. Up jumps while grounded. Power hit during a jump starts a smash animation; while standing, power hit with horizontal input starts a dive. Vertical and horizontal inputs also affect smash direction and speed.

## Controller and scoring

The sequence is intro, menu, selection fade, delay, new game message, active round, round-end slow motion/fade, then the next round. Match end uses winner/loser animations before returning to the intro. Restart returns to the intro.

Default speed is 25 physics updates per second; options select 20, 25, or 30. There is no elapsed-time integration: changing ticker speed changes real-time gameplay speed. Six slow-motion updates follow a non-final scoring point, using skipped ticker frames and a nominal 5 FPS slow-motion setting.

Scores belong to the two sides. A ground contact on the left awards the right side a point and the next serve; a contact on the right awards the left side a point and the next serve. The default target is 15, with 5 and 10 also offered. There is no win-by-two requirement. Left serves first. Practice mode hides scores and bypasses point/round ending so the ball continues bouncing.

New rounds reset both player movement states and reinitialize the ball. The ball begins at x=56 for a left serve or x=376 for a right serve, y=0, with velocity (0, 1). Players begin at x=36 and x=396, y=244. Ball rotation and trail history are not all reset by the round initializer.

## Original physics rules to preserve

Coordinates increase rightward and downward. Court width is 432; the net is at x=216. Players are 64 by 64, with half-size 32. Ball radius is 20. Player ground-center height is y=244; the ball ground-center threshold is y=252. These are engine values and need not match visible sprite edges.

Each physics frame performs these operations in order:

1. Update ball rotation/history, resolve world interactions, and move the ball once. Record whether it reached the ground.
2. For the left player and then the right player, recompute the expected ball landing point and update player movement. Computers replace their input using the AI at this stage.
3. Check player-ball overlap for the left player and then the right player, applying a response only on entering contact. Each player tracks its own contact latch.
4. Return the previously recorded ground-contact result to the controller.

There is no player-player collision routine. Players stay on their own half because movement clamps their centers to [32, 184] on the left and [248, 400] on the right.

Normal horizontal movement is 6 units per frame; diving is 8. Jump velocity starts at -16, with vertical velocity increasing by 1 each airborne frame. A dive begins with vertical velocity -5 and transitions into a short lying-down state after landing. Player states are normal (0), jumping (1), jumping/power-hitting (2), diving (3), lying down (4), winning (5), and losing (6).

A normal ball hit derives horizontal speed from horizontal center displacement divided by 3 and truncated to an integer. Zero horizontal speed is randomized when applicable. Vertical velocity becomes upward, with magnitude at least 15. A power hit sends horizontal speed toward the opposite half at magnitude 10 or 20 depending on input, and sets vertical speed to twice its previous magnitude times vertical input (-1, 0, or 1). The engine does not replace these rules with physical momentum or elastic collision equations.

The net collision region is within 25 horizontal units of its center and below y=176. Through y=192, descending balls bounce upward. Below that region, horizontal velocity is forced away from the net. The top boundary sets vertical velocity to 1 when the next position would cross y=0. On ground contact, the engine reverses vertical velocity, snaps y to 252, creates the punch effect, and returns before normal horizontal movement and gravity for that frame.

## Quirks and possible defects intentionally preserved

- **Asymmetric walls:** the next ball center is compared against x=20 on the left and x=432 on the right, rather than symmetric radius-adjusted bounds. The source explicitly calls out this asymmetry. Do not fix it.
- **Square overlap test:** a player touches the ball when both center differences are at most 32. The test does not add the ball radius or calculate circular distance. This is part of the existing feel.
- **No separation correction:** player-ball response changes velocity without repositioning the ball. A per-player latch suppresses another response until overlap ends. Do not add positional separation or continuous collision detection.
- **Discrete collision checks:** net/player overlap checks use sampled positions. Fast motion can produce surprising contacts or missed intersections; this is a potential consequence of the algorithm, not a runtime-confirmed defect from this review.
- **Frame order matters:** ground contact is recorded before player responses; an overlapping player may still affect the ball later in that frame, while the controller scores from the earlier ground result. Multiple contacts are handled sequentially.
- **Hyper-ball sprite glitch:** fine rotation wraps only when greater than 50, so exactly 50 selects rotation frame 5. Rotation is not fully reset between rounds, allowing the special appearance to persist. The source explains this behavior explicitly.
- **Landing prediction differs at a net edge:** the ordinary predictor uses y<192 where real net handling uses y<=192. Preserve the discrepancy.
- **Power-hit prediction uses different net behavior:** it predicts an upward bounce without faithfully reproducing the lower-net horizontal response. The AI may choose shots that bounce back. The source includes an unused alternative; do not activate it.
- **Predictor loop guard:** both prediction routines have a 1000-iteration cap already present in this JavaScript port. The comments say the original machine code had no such cap. Preserve the current port, including this guard.
- **Random decisions:** AI boldness, standby positions, shot search order, and some ball responses consume randomness. Additional players may change the random-number sequence. Original 1v1 execution should retain its call order.

## Computer behavior

AI runs inside the player movement routine and writes the same input shape as a human. It follows predicted landing positions, selects standby positions, jumps or dives based on ball proximity and a randomized boldness value, and searches possible power-hit directions using its shot predictor. It receives exactly one opponent. It has no concept of a teammate, court coverage division, or two opposing defenders.

## Implemented 2v2 extension

`physics.js` remains byte-for-byte unchanged (SHA-256 `00270c8a426921d04e5e09b3207ec4fd81ead7e956561488518834c0e90b08e6`). `doubles_physics.js` is a separate adaptation: it copies the original helper routines and changes per-match geometry, player orchestration, nearest-opponent selection, team coverage inputs, and round setup. The tests compare all copied helper tokens and compare seeded behavior with the original at equal geometry. No wall, net, jump, dive, hit-response, prediction, or rotation quirks were repaired.

English and Korean default to 2v2. The animated selector offers **2 Humans vs 2 Computers**, **2 Humans vs 2 Humans**, and **1 Human + 3 Computers**, with translated Korean labels. In the solo-human option, confirm with **Z → P1**, **V → P2**, **comma → P3**, or **Enter → P4**; the other three positions are computers. Positions remain P1/P2 on the left and P3/P4 on the right. Directional menu navigation moves one row per press in 2v2 so a held direction cannot skip a choice. The animated tiled background fills the full configured court width, including both screen edges, while titles and choices stay centered. Use jump/down to select and a hit key to confirm; during the opening animation, a hit skips to selection. In the HTML **Game** menu, select **Original 1v1** or **2v2** to restart in that format. Original mode retains the original controls and selection logic, including choosing the human's side by the confirming key. The Chinese page retains original 1v1.

### Configuration

In English/Korean, open **Options → 2v2 width per side**, enter an integer of at least 216, and click **Apply** (or press Enter). Applying a different width restarts an active 2v2 match at 0–0 with the same human/computer lineup. The setting remains available when switching formats; changing it in original mode configures the next 2v2 match without resizing 1v1. It lasts for the current page session.

To change the initial width or serve/tint defaults, edit `src/resources/js/doubles_config.js`, then rebuild:

```js
export const DOUBLES_CONFIG = {
  courtWidth: 384, // EACH half; total width = 768. Original half = 216.
  serveMode: 'rotate-ball', // 'rotate-players', 'rotate-ball', or 'fixed'.
  playerTints: [0xffdf72, 0xffa080, 0x70ffff, 0xff70ff], // P1 through P4
};
```

The half-width must be an integer of at least 216. The renderer, floor tiles, net, scoreboards, messages, fade, page aspect ratio, physics boundaries, and AI predictions use the configured geometry. Height remains 304. Character size, ball size, speeds, gravity, and collision formulas remain unchanged. A larger court changes travel distances and timing naturally; it does not stretch player or ball physics. Decorative wave columns repeat the original decorative model across the extended court, while original clouds retain their decorative motion.

### Confirmed four-player controls

All humans play locally on one keyboard. P1 and P2 form the left team; P3 and P4 form the right team. Each player has a distinct tint in array order above. Semicolon, quote, and comma mean physical keys; Shift is not required, even if the printed reference uses :, double quote, or <. The About panel includes this control table in English/Korean.

| Player | Jump     | Left       | Combined down-right | Right       | Down       | Hit / confirm |
| ------ | -------- | ---------- | ------------------- | ----------- | ---------- | ------------- |
| P1     | W        | A          | S                   | D           | X          | Z             |
| P2     | Y        | G          | H                   | J           | B          | V             |
| P3     | P        | L          | None                | Quote       | Semicolon  | Comma         |
| P4     | Up arrow | Left arrow | None                | Right arrow | Down arrow | Enter         |

### Team behavior and serving

- Teammates can overlap and pass through each other. There is no teammate collision, push, or separation.
- One shared ball advances exactly once per physics frame. All four movement updates follow, then contact checks run in fixed order P1, P2, P3, P4. Overlapping teammates may both hit in one frame, with separate original contact latches. The later response determines final velocity.
- In two-humans vs computers, P1/P2 are human and P3/P4 are computers. In solo-human mode, only the confirming key’s position is human, and each of the other three positions uses the computer AI. Each computer independently uses the original AI routines, considering the nearest opposing human by horizontal distance as its one opponent. Computer teammates now split their half at its midpoint. The outer round-start player covers the back zone, and its partner covers the front zone; roles follow the selected serve mode: rotating-player serves swap the roles, while the fixed-player modes retain them. The player responsible for the predicted landing zone uses the original AI inputs, while its partner returns to a separate standby position. Coverage adjusts directional/jump/dive inputs only; it adds no physical barrier, teleport, or velocity correction. An ongoing dive can briefly cross a zone boundary, after which the player walks back. The same policy applies to both teams in the all-computer demonstration. In the idle all-computer demonstration, the nearest opposing computer supplies that opponent instead.
- Scores belong to teams. Ground contact awards the other side a point and the next serve, just as in 1v1. Both members of the winning team receive the win state; both opponents receive the loss state. Practice, speed, pause, restart, and winning-score settings continue to apply.
- Left serves first with P1. Team serving sequences are independent and reset for a new match. Only the serving team's sequence advances each round.
- In **Options → 2v2 serve…**, choose a serve option and Apply. A changed option restarts an active 2v2 match with the same lineup and width; Cancel or Escape leaves the match intact. The choice lasts for the current page session and is retained when switching formats. Changing the setting in original mode configures the next 2v2 match without changing 1v1.

| Serve option                                                       | Player starting positions                                                                                     | Ball starting position                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Back ball; alternate player positions (`rotate-players`)        | Teammates swap back/middle positions each time their team serves; AI back/front roles follow those positions. | Always 56 units from the serving side's outside wall.                          |
| 2. Fixed players; alternate ball position (`rotate-ball`, default) | P1/P3 at the back, P2/P4 at the middle of their half; AI roles stay fixed.                                    | Alternates between teammates, 20 units toward the net from the serving player. |
| 3. Fixed players and ball (`fixed`)                                | P1/P3 at the back, P2/P4 at the middle of their half; AI roles stay fixed.                                    | Always 56 units from the serving side's outside wall; P1/P3 always serve.      |

The back starting position is 36 units from the outside wall. The middle position is the integer half of that half-court's width. All options keep the original ball drop height (0), velocity (0, 1), and the 20-unit inward offset; no movement or collision helper is changed. Round initialization covers all four players. In option 1 the receiving side places its next designated server at the back; in options 2 and 3 both sides always use the fixed positions above.

### Verification and local development

Run `npm test` for checksum preservation, copied-helper equivalence, seeded ball/movement/AI comparisons, serve rotation and fixed serving, one-ball stepping, teammate pass-through, simultaneous hits, alternative widths, finite AI rallies, physical keyboard inputs, match choices, mode switching, team scoring, winners, practice behavior, width-change restarts, independent per-match geometry, rotating front/back coverage, all three serve policies, serve-setting restarts, all four solo-human positions, and three-choice menu navigation. The test command requires Node 18 or newer and uses the lockfile's existing Acorn dependency to compare helper tokens.

Use a lockfile-aware npm (8 or newer) for `npm ci`: npm 6 on the development machine omitted required Pixi peer dependencies and could not build. This was resolved using Node's bundled npm 10 without modifying package dependencies or the lockfile. `npm run build` generates the production game, and `npm start` runs the development server. The build can report existing bundle-size and outdated Browserslist-data warnings.

Final checks: all 18 regression tests pass, ESLint passes for changed game scripts, and the production build succeeds. Headless Chrome checks cover all three 2v2 selections in English and Korean, including all four solo-human confirming keys and full-width menu backgrounds at four court widths, original/2v2 switching, the Chinese original entry point, background coverage, and landscape/portrait aspect ratio. No browser runtime exceptions were observed. These automated checks do not substitute for a four-person play session on a physical keyboard.

### Service worker precaching

`webpack.common.js` sets Workbox's `maximumFileSizeToCacheInBytes` to 8 MiB. This includes the roughly 3.11 MB vendor bundle generated by the development build with inline source maps, which exceeded Workbox's default 2 MiB limit. The development build was checked to confirm that bundle is present in the generated `sw.js` precache manifest.
