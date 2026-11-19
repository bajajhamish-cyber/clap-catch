# 👏 Clap Catch: secure version

There are two parts now:
- **`site/`**: the website. Goes on **GitHub Pages** like before.
- **`server/`**: the game server. Goes on **Cloudflare** (free, no card).

The server runs the game and every account change. Browsers can only send button presses,
so changing the game with dev tools can't win games or give you anything.

---

## Setup (about 20 minutes, one time)

### 1. Install Node.js (needed to upload the server)
Download the **LTS** version (22 or newer) from **nodejs.org** and install it (just click Next).

### 2. Make a free Cloudflare account
Go to **dash.cloudflare.com/sign-up**. No card needed.

### 3. Upload the server
1. Open the `server` folder. Click the address bar at the top of the window, type `cmd`, and press Enter. A black window opens in that folder.
2. Type these one at a time (press Enter after each):
   ```
   npm install
   set CF_API_TOKEN=
   set CLOUDFLARE_API_TOKEN=
   set CF_ACCOUNT_ID=
   set CLOUDFLARE_ACCOUNT_ID=
   npx wrangler login
   npx wrangler deploy
   ```
   - `wrangler login` opens your browser: click **Allow**.
   - The first `deploy` may ask you to pick a **workers.dev** name (e.g. your username). Pick anything.
3. When it finishes it prints an address like `https://clap-catch-server.yourname.workers.dev`. **Copy it.**

### 4. Give the server your Firebase key
1. Cloudflare dashboard → **Workers & Pages** → **clap-catch-server** → **Settings** → **Variables and Secrets** → **Add**.
2. Type: **Secret**. Name: `FIREBASE_SERVICE_ACCOUNT`.
3. Value: open your Firebase key `.json` file in Notepad, select everything (Ctrl+A), copy, paste.
4. Click **Deploy** / **Save**.
5. Check it works: open your server address in a browser. You should see `"firebaseKey":"loaded (clap-catch)"`. If not, it tells you what's wrong.

### 5. Point the website at your server
Already done: `site/js/config.js` points at `https://clap-catch-server.hamish-games.workers.dev`.
If your server address ever changes, change it there.

### 6. Lock down Firebase
- **Firestore → Rules**: paste `firestore.rules` → **Publish**.
- **Realtime Database → Rules**: paste `database.rules.json` → **Publish** (the game doesn't use it any more).

### 7. Upload the website
In your GitHub repo, **delete the old files** (`index.html`, `css/`, `js/`), then upload everything
**inside** the `site` folder (`index.html`, `css`, `js`, `.nojekyll`).

Done! Everyone's accounts, points and items are kept.

---

## Limited-time events (admin only)
Log in as **bajajhamish**, press **P**, and use **⏳ Limited-time events**: pick an event, how long, then **Start event**.
Only one runs at a time (starting another replaces it), it switches itself off when the timer ends, and trading is free while it's on.
Players see a banner and a **⏳ Limited** tab. Events: Golden Games, Lucky Event, Bounty Hunt, Blackout, and the
Illusioner / Barbaric / Angel / Devil / Legendary Skin packs (each pack is only in the shop during its event; what people get is theirs forever).
Game rooms notice a new event within about 20 seconds; menus within a minute (or on refresh).

## Friends and the Board
- **👥 Friends:** send a request by username; they accept. You can see where friends are and press **Join** to go into their game
  (matchmade, private or a High Risk lobby). In a matchmade game where *everyone* came in through friends, it waits for a stranger,
  or for bots after 25 seconds. Matchmade rooms can now only be entered through Find a match or a friend's Join button.
- **🎟️ Board:** 100 slots at 100 points each, as many per player as they like. When it's full, 1 random slot wins a random limited
  pack and the other 99 each get a random 50-point ability pack. Everyone gets a message with what they won, and a new board starts.
- If someone holds the ball for 30 seconds without throwing, it's thrown for them, so nobody can freeze a game.

## If something goes wrong
- **"Can't reach the game server"**: check the address in `site/js/config.js` (step 5) and that step 4 is saved.
- **Server page says `firebaseKey: MISSING`**: redo step 4 (paste the whole file, including the `{` and `}`).
- **Free limit**: Cloudflare's free plan allows 100,000 requests a day. If you go over, the game stops until
  **11am Sydney time** the next day. It never charges you.
- **Updating the server later**: open `cmd` in the `server` folder and type:
  ```
  set CF_API_TOKEN=
  set CLOUDFLARE_API_TOKEN=
  set CF_ACCOUNT_ID=
  set CLOUDFLARE_ACCOUNT_ID=
  npx wrangler deploy
  ```
  (The `set` lines stop an old Cloudflare login saved on this computer from getting in the way.)
- **Daily limit**: if the free amount runs out, players see a "Clap Catch is resting" screen telling them when it's back.

## Never share
Your Firebase key `.json` file. It's only pasted into Cloudflare (step 4), never into GitHub or chat.
