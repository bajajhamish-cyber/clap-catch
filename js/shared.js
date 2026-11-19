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
};

const RARITY = {
  common:    { label: "Common",    color: "#9aa4b2" },
  rare:      { label: "Rare",      color: "#4fc3f7" },
  legendary: { label: "Legendary", color: "#ffb300" },
};

const ABILITY_PACKS = {
  guardian:  { name: "Guardian Pack",  icon: "🛡️", theme: "Defence: block and cancel",
               items: [["antiForce", 45, "common"], ["brace", 40, "common"], ["ward", 14, "rare"], ["absoluteCounter", 1, "legendary"]] },
  control:   { name: "Control Pack",   icon: "⛓️", theme: "Control: tell people where to throw",
               items: [["counterForce", 45, "common"], ["speedUp", 40, "common"], ["doubleForce", 14, "rare"], ["nuke", 1, "legendary"]] },
  trickster: { name: "Trickster Pack", icon: "🃏", theme: "Tricks: swap, come back, burn",
               items: [["swap", 45, "common"], ["decoy", 40, "common"], ["redo", 14, "rare"], ["fireball", 1, "legendary"]] },
};
function abilityRarity(id) {
  for (const p of Object.values(ABILITY_PACKS)) for (const [a, , r] of p.items) if (a === id) return r;
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
const SKIN_IDS = [].concat(...Object.values(SKIN_PACKS).map(p => p.skins));
function skinRarity(id) {
  for (const p of Object.values(SKIN_PACKS)) { const i = p.skins.indexOf(id); if (i >= 0) return SKIN_ODDS[i][0]; }
  return "common";
}

const ECON = {
  START_POINTS: 0, PACK_COST: 50, SKIN_PACK_COST: 100, TRADE_COST: 5,
  WIN_POINTS: 25, ELIM_POINTS: 5, RISK_MIN_STAKE: 5, BAN_MS: 30 * 60 * 1000,
  TEAM_STREAK: 3, TEAM_COOLDOWN: 3, ADMIN_USERNAME: "bajajhamish", MAX_PLAYERS: 6,
};
