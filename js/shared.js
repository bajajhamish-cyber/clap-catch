// ======================================================================
//  shared.js: game data used by BOTH the server and the website.
//  (The website has an identical copy in site/js/shared.js.)
// ======================================================================
const RULES = {
  doubleClap:      { name: "Clap x2",          type: "passive", icon: "👏👏", desc: "You must clap twice before catching (and twice for a nuke)." },
  noJuke:          { name: "No Juke",          type: "passive", icon: "🚫🎭", desc: "Space throws instantly. No charging, no faking." },
  hotPotato:       { name: "Hot Potato",       type: "passive", icon: "🥔", desc: "Hold the ball longer than 3s and you're OUT." },
  spinning:        { name: "Spinning",         type: "passive", icon: "🌀", desc: "Your aim cycles to the next player every 5s by itself. You can't control it." },
  soulsteal:       { name: "Soulsteal",        type: "passive", icon: "👻", desc: "The first player you get out each round by making them mess up a catch (no clap, drop or fireball): you steal their unused abilities (not Redo)." },
  fireball:        { name: "Fireball",         type: "ability", icon: "🔥", desc: "Right after you throw (before 35% of the way): they don't need to clap, but if they press catch they're OUT. If it lands, it's theirs: wait for their bar to show before they can throw." },
  swap:            { name: "Swap",             type: "ability", icon: "🔄", desc: "While you hold the ball: swap places with whoever threw it to you. Not while the ball's flying, or once your bar is at 50%." },
  doubleForce:     { name: "Double Force",     type: "ability", icon: "⛓️", desc: "The holder must throw to you now AND the next time they get the ball. If you're out by then, they're out. If two people are forcing you to throw to them, you have 3 seconds to Ward or for someone to use Full Counter, or you're out. The forcer can press G G G to sacrifice themselves so the holder can't pass to them." },
  antiForce:       { name: "Anti Force",       type: "ability", icon: "🛡️", desc: "The holder can't throw to you this turn. Not in 1v1, not if they're double-forced." },
  counterForce:    { name: "Counter Force",    type: "ability", icon: "🎯", desc: "Click a player: the holder must throw to them this turn (can't be you). Not allowed if a force is already on them." },
  absoluteCounter: { name: "Full Counter", type: "ability", icon: "⛔", desc: "This turn, all active abilities and any used after it don't work. Also clears double forces on whoever has the ball, and cancels a nuke." },
  ward:            { name: "Ward",             type: "ability", icon: "🔰", desc: "While you hold the ball: remove every force, counter force and anti force on you." },
  nuke:            { name: "Nuke",             type: "ability", icon: "☢️", desc: "Throw it to the middle at half speed. EVERYONE (you too) must clap before it lands or they're out. If nobody claps, the round resets and everyone comes back." },
  brace:           { name: "Brace",            type: "ability", icon: "🧱", desc: "For 3 seconds, clapping on a fake doesn't get you out." },
  speedUp:         { name: "Speed Up",         type: "ability", icon: "⏩", desc: "Use when someone else has the ball: their next throw flies 40% faster, so it's harder to clap and catch." },
  decoy:           { name: "Decoy",            type: "ability", icon: "🪞", desc: "While you hold the ball: everyone else sees your aim line pointing at the wrong person until you throw." },
  redo:            { name: "Redo",             type: "ability", icon: "💖", desc: "Once per round, come back in after you get out. Can't be stolen." },

  // ---- limited packs (only sold during their event; you keep them forever). Competitive only.
  // Illusioner
  mirage:        { name: "Mirage",          type: "ability", limited: true, icon: "🌫️", desc: "For 2 turns, everyone else can't see names and every player looks the same colour." },
  wideGrip:      { name: "Wide Grip",       type: "ability", limited: true, icon: "🙌", desc: "For 2 turns, your catch zone is 2.5x bigger: you can catch the ball much earlier." },
  ghostBall:     { name: "Ghost Ball",      type: "ability", limited: true, icon: "👻", desc: "While you hold the ball: your next throw is invisible until it's 10% away from them." },
  clone:         { name: "Clone",           type: "ability", limited: true, icon: "👥", desc: "When someone else has the ball: a clone of you appears that looks exactly like you. They must throw to you or the clone. Throw to the clone and THEY'RE OUT." },
  flash:         { name: "Flash",           type: "ability", limited: true, icon: "⚡", desc: "\"FLASH INCOMING\" + a beep, then everyone else's screen goes white for 1 second." },
  // Barbaric
  quake:         { name: "Quake",           type: "ability", limited: true, icon: "🌋", desc: "Shakes everyone else's screen for 2 seconds." },
  giant:         { name: "Giant",           type: "ability", limited: true, icon: "🦍", desc: "For 1 turn you're 1.5x bigger and so is your catch zone." },
  warCry:        { name: "War Cry",         type: "ability", limited: true, icon: "📢", desc: "When someone else has the ball: their bar fills up by itself and they can't let go (in No Juke they throw straight away)." },
  bullRush:      { name: "Bull Rush",       type: "ability", limited: true, icon: "🐂", desc: "When someone else has the ball and their bar is under 60%: you charge into them, steal the ball and run back with it." },
  stampede:      { name: "Stampede",        type: "ability", limited: true, icon: "🦬", desc: "A faster Bull Rush. They also can't throw to anyone except the players right next to them for 3 turns." },
  // Angel
  blindingLight: { name: "Blinding Light",  type: "ability", limited: true, icon: "🌟", desc: "When someone else has the ball: their next throw flies 3x slower." },
  angelicScream: { name: "Angelic Scream",  type: "ability", limited: true, icon: "🔊", desc: "When the ball is flying to you (before halfway): a sound wave throws it back to the thrower from midway. They must clap and catch!" },
  fullWipe:      { name: "Full Wipe",       type: "ability", limited: true, icon: "🧽", desc: "Removes every passive rule that's on right now." },
  neutralise:    { name: "Neutralise",      type: "ability", limited: true, icon: "🚫", desc: "Costs 5 of your points. Click a player: all their abilities are used up for this round." },
  heavenlyWrath: { name: "Heavenly Wrath",  type: "ability", limited: true, icon: "⚖️", desc: "Give a player 5 of your points. Then there's a 50% chance they're OUT." },
  // Devil
  hellfire:      { name: "Hellfire",        type: "ability", limited: true, icon: "😈", desc: "While you hold the ball: your next throw is 1.5x slower, and turns into a fireball when it's 20% away from them. Catch after that = OUT." },
  jumpScare:     { name: "Jump Scare",      type: "ability", limited: true, icon: "👹", desc: "Jump scares a random player. It could be you! Not while you hold the ball." },
  phantomThrow:  { name: "Phantom Throw",   type: "ability", limited: true, icon: "🎭", desc: "While you hold the ball: your aim line is hidden and you throw two balls. One is a see-through fake: clap for the fake and you're OUT." },
  vengeance:     { name: "Vengeance",       type: "ability", limited: true, icon: "🗡️", desc: "After you're knocked out, within 1 turn: whoever got you out is OUT too." },
  devilsDeal:    { name: "Devil's Deal",    type: "ability", limited: true, icon: "🎡", desc: "Pay a player 500 of your points. The game pauses and a wheel spins: 10% chance to steal their rarest ability FOREVER." },
};

const RARITY = {
  common:    { label: "Common",    color: "#9aa4b2" },
  rare:      { label: "Rare",      color: "#4fc3f7" },
  legendary: { label: "Legendary", color: "#ffb300" },
  mythical:  { label: "Mythical",  color: "#ff4dff" },
};
const RARITY_RANK = { common: 0, rare: 1, legendary: 2, mythical: 3 };

const ABILITY_PACKS = {
  guardian:  { name: "Guardian Pack",  icon: "🛡️", theme: "Defence: block and cancel",
               items: [["antiForce", 45, "common"], ["brace", 40, "common"], ["ward", 14, "rare"], ["absoluteCounter", 1, "legendary"]] },
  control:   { name: "Control Pack",   icon: "⛓️", theme: "Control: tell people where to throw",
               items: [["counterForce", 45, "common"], ["speedUp", 40, "common"], ["doubleForce", 14, "rare"], ["nuke", 1, "legendary"]] },
  trickster: { name: "Trickster Pack", icon: "🃏", theme: "Tricks: swap, come back, burn",
               items: [["swap", 45, "common"], ["decoy", 40, "common"], ["redo", 14, "rare"], ["fireball", 1, "legendary"]] },
};
// limited packs: only in the shop while their event is on
const LIMITED_PACKS = {
  illusioner: { name: "Illusioner Pack", icon: "🎩", kind: "ability", cost: 150, theme: "Tricks of the eye",
                items: [["mirage", 44.9, "common"], ["wideGrip", 40, "common"], ["ghostBall", 14, "rare"], ["clone", 1, "legendary"], ["flash", 0.1, "mythical"]] },
  barbaric:   { name: "Barbaric Pack", icon: "🪓", kind: "ability", cost: 150, theme: "Brute force",
                items: [["quake", 44.9, "common"], ["giant", 40, "common"], ["warCry", 14, "rare"], ["bullRush", 1, "legendary"], ["stampede", 0.1, "mythical"]] },
  angel:      { name: "Angel Pack", icon: "😇", kind: "ability", cost: 200, theme: "Holy powers",
                items: [["blindingLight", 44.95, "common"], ["angelicScream", 40, "common"], ["fullWipe", 14, "rare"], ["neutralise", 1, "legendary"], ["heavenlyWrath", 0.05, "mythical"]] },
  devil:      { name: "Devil Pack", icon: "😈", kind: "ability", cost: 200, theme: "Dirty tricks",
                items: [["hellfire", 44.95, "common"], ["jumpScare", 40, "common"], ["phantomThrow", 14, "rare"], ["vengeance", 1, "legendary"], ["devilsDeal", 0.05, "mythical"]] },
  legendary:  { name: "Legendary Skin Pack", icon: "💎", kind: "skin", cost: 500, theme: "The rarest looks",
                items: [["brown", 60, "common"], ["gold", 5, "legendary"], ["rainbow", 5, "legendary"], ["lava", 5, "legendary"], ["blackHole", 5, "legendary"],
                        ["sprinkles", 5, "legendary"], ["glitch", 5, "legendary"], ["mage", 3, "mythical"], ["barbarian", 3, "mythical"], ["angel", 2, "mythical"], ["devil", 2, "mythical"]] },
};
// limited-time events (the admin turns one on, with a timer)
const EVENTS = {
  golden:     { name: "Golden Games",  icon: "🏆", desc: "Everything turns gold. 2x points for wins and getting people out. 1 in 10,000 wins gives a FREE legendary ability (Fireball, Full Counter or Nuke). If your game has one, the ball glows rainbow!" },
  lucky:      { name: "Lucky Event",   icon: "🍀", desc: "Every legendary and mythical item is 1.5% more likely in every pack." },
  bounty:     { name: "Bounty Hunt",   icon: "🎯", desc: "Every round one random player wears a 💰 bounty. Get them out for +25 extra points (Find a match and High Risk)." },
  blackout:   { name: "Blackout",      icon: "🌑", desc: "The lights go out. You only see the glowing players and ball, and aim lines stay hidden until the bar is half full." },
  illusioner: { name: "Illusioner Pack", icon: "🎩", pack: "illusioner", desc: "The Illusioner Pack is in the shop (⭐ 150). It leaves when the event ends; what you get is yours forever." },
  barbaric:   { name: "Barbaric Pack",   icon: "🪓", pack: "barbaric",   desc: "The Barbaric Pack is in the shop (⭐ 150). It leaves when the event ends; what you get is yours forever." },
  angel:      { name: "Angel Pack",      icon: "😇", pack: "angel",      desc: "The Angel Pack is in the shop (⭐ 200). It leaves when the event ends; what you get is yours forever." },
  devil:      { name: "Devil Pack",      icon: "😈", pack: "devil",      desc: "The Devil Pack is in the shop (⭐ 200). It leaves when the event ends; what you get is yours forever." },
  legendary:  { name: "Legendary Skins", icon: "💎", pack: "legendary",  desc: "The Legendary Skin Pack is in the shop (⭐ 500). It leaves when the event ends; what you get is yours forever." },
};
const GOLDEN_JACKPOT = 1 / 10000;
const JACKPOT_PRIZES = ["fireball", "absoluteCounter", "nuke"];
// Lucky event: every legendary/mythical item +1.5%, taken from the most common item
function luckyOdds(items) {
  const out = items.map(it => it.slice());
  const boosted = out.filter(it => it[2] === "legendary" || it[2] === "mythical");
  if (!boosted.length) return out;
  const top = out.reduce((a, b) => (b[1] > a[1] ? b : a));
  boosted.forEach(it => { it[1] = +(it[1] + 1.5).toFixed(2); });
  top[1] = +(top[1] - 1.5 * boosted.length).toFixed(2);
  return out;
}
function abilityRarity(id) {
  for (const p of [...Object.values(ABILITY_PACKS), ...Object.values(LIMITED_PACKS)]) if (p.kind !== "skin") for (const [a, , r] of p.items) if (a === id) return r;
  return "common";
}

const SKIN_ODDS = [["common", 65], ["rare", 28], ["legendary", 7]];
const SKIN_PACKS = {
  classic: { name: "Classic Pack", icon: "🎨", skins: ["mint", "sunset", "gold"] },
  neon:    { name: "Neon Pack",    icon: "💡", skins: ["neonPink", "neonCyan", "rainbow"] },
  nature:  { name: "Nature Pack",  icon: "🌿", skins: ["leaf", "ocean", "lava"] },
  space:   { name: "Space Pack",   icon: "🌌", skins: ["moon", "galaxy", "blackHole"] },
  candy:   { name: "Candy Pack",   icon: "🍬", skins: ["candyStripe", "cookie", "sprinkles"] },
  tech:    { name: "Tech Pack",    icon: "💾", skins: ["circuit", "checker", "glitch"] },
};
const EXTRA_SKINS = { brown: "common", mage: "mythical", barbarian: "mythical", angel: "mythical", devil: "mythical" };   // Legendary Skin Pack only
const SKIN_IDS = [].concat(...Object.values(SKIN_PACKS).map(p => p.skins), Object.keys(EXTRA_SKINS));
function skinRarity(id) {
  if (EXTRA_SKINS[id]) return EXTRA_SKINS[id];
  for (const p of Object.values(SKIN_PACKS)) { const i = p.skins.indexOf(id); if (i >= 0) return SKIN_ODDS[i][0]; }
  return "common";
}

const ECON = {
  START_POINTS: 0, PACK_COST: 50, SKIN_PACK_COST: 100, TRADE_COST: 5,
  WIN_POINTS: 25, ELIM_POINTS: 5, RISK_MIN_STAKE: 5, BAN_MS: 30 * 60 * 1000,
  TEAM_STREAK: 3, TEAM_COOLDOWN: 3, BOUNTY_POINTS: 25, NEUTRALISE_COST: 5, WRATH_COST: 5, DEAL_COST: 500, BOARD_SLOTS: 100, TUTORIAL_VERSION: 2, BOARD_SLOT_COST: 100, ADMIN_USERNAME: "bajajhamish", MAX_PLAYERS: 6,
};

