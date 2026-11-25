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
  // ---- Titan Pack (unlocked by beating the Story boss)
  heavyBall:     { name: "Heavy Ball",      type: "ability", story: true, icon: "🪨", desc: "When someone else has the ball: it turns to stone, so their bar fills 2x slower this turn." },
  boomerang:     { name: "Boomerang",       type: "ability", story: true, icon: "🪃", desc: "While you hold the ball: your next throw comes straight back after they catch it, so they never get a turn. Be ready to clap and catch it yourself!" },
  shockwave:     { name: "Shockwave",       type: "ability", story: true, icon: "💥", desc: "When someone else has the ball: their bar empties and they can't charge for 1.5 seconds." },
  titanThrow:    { name: "Titan Throw",     type: "ability", story: true, icon: "⚡", desc: "While you hold the ball: your next throw is a fireball that flies 40% faster, and nobody can use abilities until it lands." },
  // ---- Shadow Pack (unlocked by beating the World 2 boss)
  shortFuse:     { name: "Short Fuse",      type: "ability", story: 2, icon: "🧨", desc: "When someone else has the ball: they have 4 seconds to throw it or they're OUT. Not on a heavy or stunned ball." },
  smokescreen:   { name: "Smokescreen",     type: "ability", story: 2, icon: "💨", desc: "While you hold the ball: nobody else can see your throw bar until you throw, so they can't tell when it's coming." },
  silence:       { name: "Silence",         type: "ability", story: 2, icon: "🤫", desc: "Click a player: they can't use any abilities for 2 turns." },
  eclipse:       { name: "Eclipse",         type: "ability", story: 2, icon: "🌑", desc: "Everyone else's screen goes dark for 3 seconds. They can only see a small circle of light around themselves." },

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
  uncommon:  { label: "Uncommon",  color: "#66bb6a" },       // accessories only (Weekly Shop)
  rare:      { label: "Rare",      color: "#4fc3f7" },
  legendary: { label: "Legendary", color: "#ffb300" },
  mythical:  { label: "Mythical",  color: "#ff4dff" },
  platinum:  { label: "Platinum",  color: "#b9f2ff" },
  og:        { label: "OG",        color: "#ffd740" },        // OG skins (one per player, never tradeable)
};
const RARITY_RANK = { common: 0, uncommon: 0.5, rare: 1, legendary: 2, mythical: 3, og: 3.5, platinum: 4 };

const ABILITY_PACKS = {
  guardian:  { name: "Guardian Pack",  icon: "🛡️", theme: "Defence: block and cancel",
               items: [["antiForce", 45, "common"], ["brace", 40, "common"], ["ward", 14, "rare"], ["absoluteCounter", 1, "legendary"]] },
  control:   { name: "Control Pack",   icon: "⛓️", theme: "Control: tell people where to throw",
               items: [["counterForce", 45, "common"], ["speedUp", 40, "common"], ["doubleForce", 14, "rare"], ["nuke", 1, "legendary"]] },
  trickster: { name: "Trickster Pack", icon: "🃏", theme: "Tricks: swap, come back, burn",
               items: [["swap", 45, "common"], ["decoy", 40, "common"], ["redo", 14, "rare"], ["fireball", 1, "legendary"]] },
  // unlocked by beating the Story boss
  titan:     { name: "Titan Pack",     icon: "⚡", theme: "The boss's power, now yours", story: true,
               items: [["heavyBall", 45, "common"], ["boomerang", 40, "common"], ["shockwave", 14, "rare"], ["titanThrow", 1, "legendary"]] },
  // unlocked by beating the World 2 boss (the Captain)
  shadow:    { name: "Shadow Pack",    icon: "🌑", theme: "The Captain's sneaky tricks", story: 2,
               items: [["shortFuse", 45, "common"], ["smokescreen", 40, "common"], ["silence", 14, "rare"], ["eclipse", 1, "legendary"]] },
};
// ---- Platinum: risk an ability in the Platinum tab, 10% chance it becomes its better version
const PLATINUM = {
  fireball: "They can't even clap: clapping at it is OUT too. The only way to survive is to let it land.",
  swap: "Works at any charge, not just under 50%.",
  doubleForce: "2 uses each round.",
  antiForce: "2 uses each round.",
  counterForce: "2 uses each round.",
  absoluteCounter: "2 uses each round.",
  ward: "2 uses each round.",
  nuke: "Everyone has 35% less time to clap.",
  brace: "Lasts 6 seconds instead of 3.",
  speedUp: "Their throw is 60% faster instead of 40%.",
  decoy: "2 uses each round.",
  redo: "Also works when you join a game that's already running: use it to jump straight in.",
  mirage: "Lasts 4 turns.",
  wideGrip: "3x catch zone for 3 turns.",
  ghostBall: "Invisible almost the whole way (until it's 3% away).",
  clone: "2 uses each round.",
  flash: "Their screens stay white for 2 seconds.",
  quake: "Shakes for 4 seconds.",
  giant: "2x bigger with a 2x catch zone, for 2 turns.",
  warCry: "2 uses each round.",
  bullRush: "Works until their bar is 85% full.",
  stampede: "Neighbours only for 5 turns.",
  blindingLight: "Their throw is 4x slower.",
  angelicScream: "Works until the ball is 80% of the way to you.",
  fullWipe: "2 uses each round.",
  neutralise: "Only costs 2 points.",
  heavenlyWrath: "75% chance they're out.",
  hellfire: "Turns to fire earlier, at 65% of the way.",
  jumpScare: "Never scares you.",
  phantomThrow: "Throws two fakes as well as the real ball.",
  vengeance: "Works up to 2 turns after you're out.",
  devilsDeal: "20% chance to steal instead of 10%.",
  heavyBall: "Their bar fills 3x slower instead of 2x.",
  boomerang: "2 uses each round.",
  shockwave: "Stuns them for 3 seconds instead of 1.5.",
  titanThrow: "Flies 55% faster instead of 40%.",
  shortFuse: "Only 3 seconds to throw.",
  smokescreen: "Hides your aim line too.",
  silence: "Lasts 3 turns.",
  eclipse: "Lasts 5 seconds.",
};
const PLAT_TWO_USES = ["boomerang", "doubleForce", "antiForce", "counterForce", "absoluteCounter", "ward", "decoy", "clone", "warCry", "fullWipe"];
Object.keys(PLATINUM).forEach(id => {
  const b = RULES[id];
  RULES["plat_" + id] = { name: "Platinum " + b.name, type: "ability", platinum: true, base: id, limited: b.limited, icon: b.icon, desc: b.desc + " PLATINUM: " + PLATINUM[id] };
});
const PLAT_CHANCE = 0.1;

// ---- Story mode: World 1 (levels 1-10) and World 2 (levels 11-20, switched on by the admin)
const SK_MOVE = "<b>W</b>/<b>S</b>";
const STORY_LEVELS = [
  // ---------------- World 1: get your power back
  { world: 1, name: "Warm Up", icon: "🌱", title: "Level 1: Warm Up",
    text: "Someone stole your full power and gave it to the boss. First, get back into shape: beat <b>3 easy bots</b> in a normal game. Clap with <b>B</b>, catch with <b>Space</b>." },
  { world: 1, name: "Two Lanes", icon: "↕️", title: "Level 2: Two Lanes",
    text: `New move! You stand on the left, the enemy on the right. Press ${SK_MOVE} to move up and down between the <b>white dots</b>. The enemy throws to one of them: get there, <b>clap</b>, then <b>catch</b>. No fakes here. Catch <b>8 in a row</b>, then throw it back with <b>Space</b>.` },
  { world: 1, name: "Dodge!", icon: "🔴", title: "Level 3: Dodge!",
    text: `Watch out for <b>dodgeballs</b>: red with a white outline. <b>Don't catch them, get out of their lane</b> with ${SK_MOVE}. Now there are 3 lanes. Survive the waves, then catch the normal ball, press <b>T</b> to turn it into a dodgeball and <b>Space</b> to throw it.` },
  { world: 1, name: "Turn the Tables", icon: "🎯", title: "Level 4: Turn the Tables",
    text: "Now <b>you</b> have the ball. The enemy moves between 2 lanes to a rhythm. Aim at a lane with <b>A</b>/<b>D</b> and throw a dodgeball with <b>Space</b>. Time it so they're in that lane when it gets there. You have <b>3 balls</b>." },
  { world: 1, name: "Crossfire", icon: "⚔️", title: "Level 5: Crossfire",
    text: `Two enemies, one on each side, both throwing dodgeballs at you. Keep dodging with ${SK_MOVE}. Sometimes one throws a <b>normal ball</b>: clap and catch it. Then aim at one of the enemy lanes with <b>A</b>/<b>D</b> and throw with <b>Space</b>. Hit both enemies to win.` },
  { world: 1, name: "Quick Hands", icon: "✋", title: "Level 6: Quick Hands",
    text: "The boss's guard has been training. Now there are <b>3 lanes</b> and the balls are faster. Clap and catch <b>10 in a row</b>, then throw it back with <b>Space</b>." },
  { world: 1, name: "Dodge Storm", icon: "🌪️", title: "Level 7: Dodge Storm",
    text: `<b>4 lanes</b> and up to <b>3 dodgeballs</b> at once. Find the safe lane with ${SK_MOVE}. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 1, name: "Moving Target", icon: "🏃", title: "Level 8: Moving Target",
    text: "The guard moves between <b>3 lanes</b>, and faster. Aim with <b>A</b>/<b>D</b> and throw with <b>Space</b>. You have <b>3 balls</b> to hit them." },
  { world: 1, name: "Twin Trouble", icon: "👯", title: "Level 9: Twin Trouble",
    text: `The twins are back, and they've got faster. You have <b>4 lanes</b> to dodge in with ${SK_MOVE}. Catch their normal balls and hit both twins to reach the boss.` },
  { world: 1, name: "The Boss", icon: "👹", title: "Level 10: The Boss",
    text: "The boss has your full power. Dodge waves of 1, 2, 3, then 4 dodgeballs across <b>5 lanes</b>. At the end, he throws normal balls in the only safe lane: <b>clap and catch</b> each one and it flies back as a dodgeball. Hit him <b>5 times</b> to win! If he gets you, you start again from wave 1." },
  // ---------------- World 2: the Shadow League
  { world: 2, name: "New Rivals", icon: "🌒", title: "Level 11: New Rivals",
    text: "With your power back, you find out the boss was only following orders from <b>the Captain</b> of the Shadow League. Their players want a game: beat <b>3 bots</b> (1 medium, 2 hard) in a normal game." },
  { world: 2, name: "Shadow Lanes", icon: "🌑", title: "Level 12: Shadow Lanes",
    text: "A Shadow League thrower blocks the way. <b>3 lanes</b>, faster balls. Clap and catch <b>12 in a row</b>, then throw it back." },
  { world: 2, name: "Night Dodge", icon: "🌃", title: "Level 13: Night Dodge",
    text: `<b>4 lanes</b> of fast dodgeballs. Move with ${SK_MOVE}, survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 2, name: "Slippery", icon: "🦎", title: "Level 14: Slippery",
    text: "This one is quick: <b>3 lanes</b>, and they barely stop. Aim with <b>A</b>/<b>D</b> and throw with <b>Space</b>. <b>3 balls</b>." },
  { world: 2, name: "Ambush", icon: "🪤", title: "Level 15: Ambush",
    text: `The Shadow Twins attack from both sides. <b>4 lanes</b>, faster dodgeballs. Catch their normal balls and hit both twins.` },
  { world: 2, name: "Rapid Fire", icon: "💨", title: "Level 16: Rapid Fire",
    text: "<b>4 lanes</b> and the fastest balls yet. Clap and catch <b>12 in a row</b>, then throw it back." },
  { world: 2, name: "Blackout Storm", icon: "⛈️", title: "Level 17: Blackout Storm",
    text: `<b>5 lanes</b> and up to <b>4 dodgeballs</b> at once. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 2, name: "Sharpshooter", icon: "🏹", title: "Level 18: Sharpshooter",
    text: "The Captain's guard moves between <b>4 lanes</b>. You have <b>4 balls</b> to hit them. Aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>." },
  { world: 2, name: "The Captain's Guard", icon: "🛡️", title: "Level 19: The Captain's Guard",
    text: `The last two guards, from both sides, as fast as they get. <b>5 lanes</b> to dodge in. Hit both of them and the Captain has nowhere left to hide.` },
  { world: 2, name: "The Captain", icon: "🦹", title: "Level 20: The Captain",
    text: "The leader of the Shadow League. Dodge waves of up to <b>5 dodgeballs</b> across <b>6 lanes</b>. At the end, catch his normal balls to send them back. Hit him <b>7 times</b> to win! If he gets you, you start again from wave 1." },
  // ---------------- World 3: the Founder (only after the update is switched on). Lose any level here and you go back to level 21.
  { world: 3, name: "The Founders' Trial", icon: "🏛️", title: "Level 21: The Founders' Trial",
    text: "The Shadow League was started by someone: <b>the Founder</b>. To get an audience, beat <b>3 bots</b> (1 hard, 2 super hard) in a normal game." },
  { world: 3, name: "Iron Hands", icon: "🧤", title: "Level 22: Iron Hands",
    text: "<b>4 lanes</b>, very fast balls. Clap and catch <b>14 in a row</b>, then throw it back." },
  { world: 3, name: "Hailstorm", icon: "🌨️", title: "Level 23: Hailstorm",
    text: `<b>5 lanes</b> and up to <b>4 dodgeballs</b> at once, faster than before. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 3, name: "Blur", icon: "👤", title: "Level 24: Blur",
    text: "The guard moves between <b>4 lanes</b> faster than ever. <b>3 balls</b>. Aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>." },
  { world: 3, name: "Pincer", icon: "🦂", title: "Level 25: Pincer",
    text: `Two of the Founder's guards from both sides. <b>5 lanes</b>, fast dodgeballs. Catch their normal balls and hit both.` },
  { world: 3, name: "No Mercy", icon: "🔩", title: "Level 26: No Mercy",
    text: "<b>5 lanes</b>. Catch <b>15 in a row</b>, faster than anything so far." },
  { world: 3, name: "Avalanche", icon: "🏔️", title: "Level 27: Avalanche",
    text: `<b>6 lanes</b> and up to <b>5 dodgeballs</b> at once. Find the one safe lane every time.` },
  { world: 3, name: "Phantom Guard", icon: "🎯", title: "Level 28: Phantom Guard",
    text: "The guard moves between <b>5 lanes</b>. You have <b>4 balls</b>." },
  { world: 3, name: "Last Line", icon: "🧱", title: "Level 29: Last Line",
    text: `The Founder's last two guards. <b>6 lanes</b> to dodge in, the fastest crossfire yet.` },
  { world: 3, name: "The Founder", icon: "🗝️", title: "Level 30: The Founder",
    text: "The one who started it all. Dodge waves of up to <b>6 dodgeballs</b> across <b>7 lanes</b>, then catch his normal balls to send them back. Hit him <b>9 times</b>." },
];
const STORY_W1 = 10, STORY_W2 = 20, STORY_W3 = 30, STORY_VERSION = 3;   // 3: the reset also re-locks the story packs
const STORY_BOTS = { 1: ["easy", "easy", "easy"], 11: ["medium", "hard", "hard"], 21: ["hard", "super", "super"] };   // levels that are normal games against bots

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
// Bonus Star: one pops up for everyone at the same moment, once every 10 minutes, for 60 seconds.
// The exact moment inside each 10 minutes is different every time (but the same for everybody).
const STAR = { EVERY: 10 * 60 * 1000, SHOW: 60 * 1000, ODDS: [[5, 80], [10, 15], [25, 5]] };
function starAt(w) { const h = Math.imul((w ^ 0x5bd1e995) >>> 0, 2654435761) >>> 0; return w * STAR.EVERY + (h % 540) * 1000; }
function starReward(r) { let x = r * 100; for (const [n, pct] of STAR.ODDS) { if ((x -= pct) < 0) return n; } return STAR.ODDS[0][0]; }
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
  if (id && id.startsWith("plat_")) return "platinum";
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
  // unlocked by beating the Story boss
  storm:   { name: "Storm Pack",   icon: "⛈️", skins: ["rain", "lightning", "tornado"], story: true },
  royal:   { name: "Royal Pack",   icon: "👑", skins: ["velvet", "crown", "dragon"], story: true },
  stone:   { name: "Stone Pack",   icon: "🗿", skins: ["pebble", "crystal", "titanCore"], story: true },
};
const EXTRA_SKINS = { brown: "common", mage: "mythical", barbarian: "mythical", angel: "mythical", devil: "mythical" };   // Legendary Skin Pack only
const SKIN_IDS = [].concat(...Object.values(SKIN_PACKS).map(p => p.skins), Object.keys(EXTRA_SKINS), ["creator_c", "creator_r", "creator_l"]);
function skinRarity(id) {
  if (EXTRA_SKINS[id]) return EXTRA_SKINS[id];
  if (id === "creator_c") return "common"; if (id === "creator_r") return "rare"; if (id === "creator_l") return "legendary";
  for (const p of Object.values(SKIN_PACKS)) { const i = p.skins.indexOf(id); if (i >= 0) return SKIN_ODDS[i][0]; }
  return "common";
}

// ---- Weekly accessory shop (unlocked by beating World 3; only after the update is switched on)
// slot: where it goes on your character. Only one per slot can be worn at a time.
const ACCESSORIES = {
  pulse:     { name: "Pulse Ring",     rarity: "common",    slot: "aura",      desc: "A ring that pulses out from your character." },
  wave:      { name: "Wave",           rarity: "common",    slot: "aura",      desc: "A shine that sweeps from the top of your character to the bottom." },
  shake:     { name: "Jitter",         rarity: "common",    slot: "motion",    desc: "Your character shakes slightly all the time." },
  shades:    { name: "Sunglasses",     rarity: "uncommon",  slot: "face",      desc: "A pair of sunglasses." },
  fade:      { name: "Fade Out",       rarity: "uncommon",  slot: "death",     desc: "When you're out, you fade away." },
  tophat:    { name: "Top Hat",        rarity: "uncommon",  slot: "hat",       desc: "A tall black top hat." },
  smiley:    { name: "Smiley",         rarity: "uncommon",  slot: "face",      desc: "A hand-drawn smiley face." },
  split:     { name: "Split",          rarity: "rare",      slot: "death",     desc: "When you're out, you split in half and fall off." },
  cap:       { name: "Cap",            rarity: "rare",      slot: "hat",       desc: "A cap. Pick its colour in your inventory." },
  fill:      { name: "Fill Up",        rarity: "rare",      slot: "charge",    desc: "Red liquid fills your character from the bottom while you charge a throw, in time with your bar." },
  bluewall:  { name: "Blue Wallpaper", rarity: "rare",      slot: "wallpaper", desc: "A blue background for your game screen." },
  explode:   { name: "Explosion",      rarity: "legendary", slot: "death",     desc: "When you're out, you explode." },
  backpack:  { name: "Backpack",       rarity: "legendary", slot: "gear",      desc: "Lets you equip 4 abilities at a time instead of 3." },
  lightning: { name: "Lightning Strike", rarity: "legendary", slot: "kill",    desc: "When you get someone out, lightning strikes them before their own out animation." },
};
const ACC_ODDS = [["common", 60], ["uncommon", 25], ["rare", 14], ["legendary", 1]];
const ACC_PRICE = { common: 120, uncommon: 250, rare: 500, legendary: 1500 };
const CAP_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00", "#212121", "#f5f5f5"];
const WEEKLY = { SLOTS: 3, REFRESH_POOL: 12500, MIN_CHIP: 10 };
// Creator Pack: 3 skins made by friends. The admin uploads the pictures. Unlocked by beating World 3.
const CREATOR_SKINS = ["creator_c", "creator_r", "creator_l"];
const CREATOR_PACK = { name: "Creator Pack", cost: 300, items: [["creator_c", 60, "common"], ["creator_r", 32, "rare"], ["creator_l", 8, "legendary"]] };

// ---- OG skins: one special skin each for these players (bajajhamish uploads the pictures)
const OG = { USERS: ["doom", "kythor", "cookie_clicker", "imsmaat"], GAMES: 50, WINS: 10, COST: 1000 };
// ---- Boss Rush (rogue-like): beat boss after boss; every level is harder. Needs World 3 beaten.
const ROGUE = { MAX: 250 };
function rogueReward(level) {             // points for clearing a level (only every 10th level pays)
  if (level % 10 !== 0) return 0;
  if (level === 100) return 150;
  return level <= 50 ? 10 : 20;
}
// the boss for a Boss Rush level. 1 = the World 1 boss, 30 = the Captain, 60 = the Founder,
// 100 = close to impossible, and it keeps getting worse up to 250.
function rogueLevel(L) {
  const K = [   // level, lanes, most balls at once, speed (lower = faster), health, waves, curveball %, ghost %, bomb %
    [1,   5, 4, 1.00, 3, 10, 0,    0,    0],
    [30,  6, 5, 0.90, 5, 14, 0.10, 0,    0],
    [60,  7, 6, 0.82, 7, 18, 0.30, 0.15, 0.10],
    [100, 7, 6, 0.50, 9, 24, 0.60, 0.40, 0.25],
    [250, 7, 6, 0.27, 12, 30, 0.90, 0.70, 0.40],
  ];
  L = Math.max(1, Math.min(ROGUE.MAX, Math.floor(L)));
  let i = 0; while (i < K.length - 2 && L > K[i + 1][0]) i++;
  const [a, b] = [K[i], K[i + 1]], f = (L - a[0]) / (b[0] - a[0]), mix = j => a[j] + (b[j] - a[j]) * f;
  return {
    lanes: Math.round(mix(1)), maxBalls: Math.round(mix(2)), speed: +mix(3).toFixed(3), hp: Math.round(mix(4)), waves: Math.round(mix(5)),
    curve: +mix(6).toFixed(3), ghost: +mix(7).toFixed(3), bomb: +mix(8).toFixed(3),
    slow: L >= 100 ? 1 : L <= 60 ? 1.25 : 1.25 - 0.25 * (L - 60) / 40,     // big waves come a bit slower early on; not any more by level 100
  };
}

const ECON = {
  START_POINTS: 0, PACK_COST: 50, SKIN_PACK_COST: 100, TRADE_COST: 5,
  WIN_POINTS: 25, ELIM_POINTS: 5, RISK_MIN_STAKE: 5, BAN_MS: 30 * 60 * 1000,
  TEAM_STREAK: 3, TEAM_COOLDOWN: 3, BOUNTY_POINTS: 25, NEUTRALISE_COST: 5, WRATH_COST: 5, DEAL_COST: 500, BOARD_SLOTS: 100, TUTORIAL_VERSION: 3, PLACE_POINTS: [20, 15, 10, 5], STORY_POINTS: 20, BOARD_SLOT_COST: 100, ADMIN_USERNAME: "bajajhamish", HELPER_USERNAME: "kythor", MAX_PLAYERS: 6,
};

