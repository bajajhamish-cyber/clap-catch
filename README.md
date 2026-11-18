# 👏 Clap Catch

Put every file in this folder into your GitHub repo (replace the old `index.html`).
The folder layout must stay the same: `index.html`, `css/`, `js/`, `.nojekyll`.

## One-time Firebase setup (about 10 minutes)

Do these in the Firebase console for your project **clap-catch**.

### 1. Realtime Database rules (the live game)
Realtime Database → **Rules** → paste everything from `database.rules.json` → **Publish**.
(These now require being logged in, so random people can't mess with rooms.
They also include the `matchmaking` section used by **Find a match**. If you pasted
an older version, paste this one again.)

### 2. Create Firestore (accounts, shop, trades)
Build → **Firestore Database** → **Create database** →
location **australia-southeast1 (Sydney)** → start in **production mode**.

### 3. Firestore rules
Firestore Database → **Rules** → paste everything from `firestore.rules` → **Publish**.

### 4. Turn on username/password login
Build → **Authentication** → **Get started** → **Sign-in method** →
**Email/Password** → Enable (only the first switch) → **Save**.

Players never see or type an email. The game turns a username like `Tim` into
`tim@clapcatch.game` behind the scenes, because that's how Firebase stores logins.
There's no password reset. Forget your password and the account is gone.

### 5. Allow your website
Authentication → **Settings** → **Authorized domains** → **Add domain** →
`YOURNAME.github.io`.
If you restricted your API key to your website earlier, that still works,
as long as `https://YOURNAME.github.io/*` is in the list.

## Numbers you can change

| What | Where |
|---|---|
| Starting points (150) | `js/app.js` → `START_POINTS` **and** `firestore.rules` (the `== 150` line) |
| Pack prices, trade fee | `js/app.js` → `PACK_COST`, `SKIN_PACK_COST`, `TRADE_COST` |
| Points per competitive win | `js/game.js` → `WIN_POINTS` |
| Pack contents and odds | `js/data.js` → `ABILITY_PACKS`, `SKIN_ODDS` |
| Bot difficulty | `js/game.js` → `BOT_LEVELS` |
| Matchmaking: wait before bots (25s), start countdown (10s), max players (6), which bots | `js/game.js` → `BOT_WAIT_MS`, `START_COUNTDOWN`, `MATCH_MAX`, `MATCH_BOTS` |

## Files
- `index.html`: the page
- `css/style.css`: how it looks
- `js/config.js`: your Firebase project
- `js/data.js`: rules, packs, skins
- `js/game.js`: the live game and bots
- `js/app.js`: login, shop, inventory, trading
- `firestore.rules`, `database.rules.json`: security rules (paste into Firebase; the website doesn't use these files)
