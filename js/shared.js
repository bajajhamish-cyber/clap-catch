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
  og:        { label: "OG",        color: "#ffd740" },
  diamond:   { label: "Diamond",   color: "#7df9ff" },        // OG skins (one per player, never tradeable)
};
const RARITY_RANK = { common: 0, uncommon: 0.5, rare: 1, legendary: 2, mythical: 3, og: 3.5, platinum: 4, diamond: 5 };

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
// ---- Diamond (Platinum tab): risk a Platinum ability. 20% it becomes Diamond, 80% it drops back to the normal ability.
// Platinum ones that were "something unique" get 2 uses each round as Diamond.
// Platinum ones that were already "2 uses each round" get something new as Diamond (and keep 2 uses).
const DIAMOND_CHANCE = 0.2;
const DIAMOND_UNIQUE = {
  doubleForce: "They must throw to you the next 3 times instead of 2.",
  antiForce: "Also braces you: fakes can't get you for 3 seconds.",
  counterForce: "The throw you force is also 40% faster.",
  absoluteCounter: "Also stuns whoever has the ball for 1.5 seconds.",
  ward: "Also lifts any Silence on you and braces you against fakes for 3 seconds.",
  decoy: "Also hides your throw bar (like Smokescreen).",
  clone: "Their bar also fills 2x slower while they decide.",
  warCry: "Also makes their panicked throw 40% faster.",
  fullWipe: "Also wipes every force in play (Double, Counter and Anti Force).",
  boomerang: "Your throw is also invisible (like Ghost Ball).",
};
const DIAMOND = {};
Object.keys(PLATINUM).forEach(id => {
  DIAMOND[id] = PLAT_TWO_USES.includes(id) ? DIAMOND_UNIQUE[id] + " Still 2 uses each round." : PLATINUM[id] + " And 2 uses each round.";
  const b = RULES[id];
  RULES["dia_" + id] = { name: "Diamond " + b.name, type: "ability", platinum: true, diamond: true, base: id, limited: b.limited, icon: b.icon, desc: b.desc + " DIAMOND: " + DIAMOND[id] };
});

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
  // ---------------- World 3: the Founder (only after the update is switched on).
  { world: 3, name: "The Founders' Trial", icon: "🏛️", title: "Level 21: The Founders' Trial",
    text: "The Shadow League was started by someone: <b>the Founder</b>. To get an audience, beat <b>3 bots</b> (1 hard, 2 medium) in a normal game." },
  { world: 3, name: "Iron Hands", icon: "🧤", title: "Level 22: Iron Hands",
    text: `<b>5 lanes</b> and up to <b>3 dodgeballs</b> at once. Every dodgeball is a <b>curve ball</b>: it heads for one lane, then <b>turns into another early in its flight</b>. Watch where it ends up, not where it starts. Move with ${SK_MOVE}, survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 3, name: "Hailstorm", icon: "🌨️", title: "Level 23: Hailstorm",
    text: "<b>4 lanes</b>, and every ball is a <b>ghost ball</b>: it vanishes partway and only shows again just before it reaches you. Remember which lane it was heading for. Clap and catch <b>10 in a row</b>, then throw it back with <b>Space</b>." },
  { world: 3, name: "Blur", icon: "👤", title: "Level 24: Blur",
    text: `<b>6 lanes</b> and every dodgeball is a <b>bomb</b>: it hits its lane <b>and the lane on each side</b>, so 3 lanes at once. Up to <b>2 bombs</b> at a time, but there is always one safe lane. Stay well clear with ${SK_MOVE}, survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 3, name: "Pincer", icon: "🦂", title: "Level 25: Pincer",
    text: `<b>5 lanes</b> and the dodgeballs <b>split in two</b> partway through their flight, so one ball can end up in two lanes. Watch both halves and find the lane that's still safe with ${SK_MOVE}. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 3, name: "No Mercy", icon: "🔩", title: "Level 26: No Mercy",
    text: "The guard moves between <b>4 lanes</b> and now has a <b>shield</b> that's only down for a moment. Time your throw so it lands when the shield is down <b>and</b> he's in that lane. Aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>. You have <b>6 balls</b>." },
  { world: 3, name: "Avalanche", icon: "🏔️", title: "Level 27: Avalanche",
    text: `<b>6 lanes</b> and up to <b>4 dodgeballs</b> at once, now a mix of <b>curve balls</b>, <b>ghost balls</b> and <b>bombs</b>. There's always one safe lane: find it with ${SK_MOVE}. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 3, name: "Phantom Guard", icon: "🎯", title: "Level 28: Phantom Guard",
    text: `Two <b>Trick Twins</b> attack from both sides across <b>5 lanes</b>. Some of their dodgeballs <b>curve</b>, and the normal balls they throw are <b>ghost balls</b>: clap and catch them. Then aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>, and hit both twins.` },
  { world: 3, name: "Last Line", icon: "🧱", title: "Level 29: Last Line",
    text: "<b>5 lanes</b>, fast balls, and every ball is a <b>curve ball</b>: it heads for one lane, then turns into another. Be in the lane it ends up in. Clap and catch <b>12 in a row</b>, then throw it back with <b>Space</b>." },
  { world: 3, name: "The Founder", icon: "🗝️", title: "Level 30: The Founder",
    text: `The one who started it all. Dodge waves of up to <b>6 dodgeballs</b> across <b>7 lanes</b>, in <b>3 phases</b>: plain balls first, then <b>curve balls</b>, then <b>bombs, ghosts and curves</b> all mixed. At the end, he throws normal balls in the only safe lane: clap and catch them to send them back. Hit him <b>9 times</b> to win! If he gets you, you start again from wave 1.` },
  // ---------------- World 4: "you" (off until bajajhamish switches it on)
  { world: 4, name: "Strange Signal", icon: "📡", title: "Level 31: Strange Signal",
    text: `With the Founder gone, something else is in the game. Something that calls itself <b>you</b>. <b>5 lanes</b> of dodgeballs, and some are <b>glitched</b>: they flicker and leave fake copies of themselves in other lanes. Only the solid one is real. Survive every wave with ${SK_MOVE}, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 4, name: "Wrong Way", icon: "🔄", title: "Level 32: Wrong Way",
    text: "you has learned how to <b>flip your controls</b>. Every few seconds, up becomes down and down becomes up for a while. A warning flashes first. <b>4 lanes</b>: clap and catch <b>10 in a row</b>, then throw it back." },
  { world: 4, name: "Deleted", icon: "🗑️", title: "Level 33: Deleted",
    text: `you starts <b>deleting lanes</b>. A lane flashes red, then it's gone for a few seconds: be in it when it goes and you're out, and you can't move into it while it's gone. <b>6 lanes</b> of dodgeballs. Survive every wave with ${SK_MOVE}, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 4, name: "Is It Real?", icon: "❓", title: "Level 34: Is It Real?",
    text: `Some dodgeballs are <b>fakes</b>: they look real until most of the way, then vanish. You can't tell which until late, but there's always a lane that's safe from real <b>and</b> fake balls. <b>6 lanes</b>. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 4, name: "Firewall", icon: "🔥", title: "Level 35: Firewall",
    text: "you hides behind a <b>firewall</b> (a shield that's only down for a moment) and moves between <b>4 lanes</b>. And your aim controls <b>flip</b> now and then too. Aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>. You have <b>6 balls</b>." },
  { world: 4, name: "Corrupted", icon: "👾", title: "Level 36: Corrupted",
    text: `Two copies of you attack from both sides across <b>5 lanes</b>, with <b>glitched</b> and <b>fake</b> dodgeballs. Catch their normal balls, then aim with <b>A</b>/<b>D</b>, throw with <b>Space</b>, and hit both copies.` },
  { world: 4, name: "Upside Down", icon: "🙃", title: "Level 37: Upside Down",
    text: `<b>Curve balls</b> and <b>flipped controls</b> together. <b>5 lanes</b>, up to <b>3 dodgeballs</b>. Survive every wave, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 4, name: "Low Memory", icon: "💾", title: "Level 38: Low Memory",
    text: "<b>5 lanes</b>, <b>ghost balls</b>, and lanes keep getting <b>deleted</b>. The ball is never thrown into a deleted lane. Clap and catch <b>12 in a row</b>, then throw it back." },
  { world: 4, name: "Overclock", icon: "⚡", title: "Level 39: Overclock",
    text: `Everything at once: <b>7 lanes</b>, up to <b>5 dodgeballs</b>, curve balls, ghosts, bombs, glitches, fakes and deleted lanes, for <b>12 waves</b>. There's always one safe lane. Survive, then catch the normal ball, press <b>T</b> and throw it back.` },
  { world: 4, name: "you", icon: "🤖", title: "Level 40: you",
    text: `<b>you</b> has become sentient, and it wants to be the one playing. This is the hardest fight in the game: <b>40 waves</b> across <b>7 lanes</b> in <b>4 phases</b>. Glitches and fakes, then flipped controls, then deleted lanes and bombs, then… something goes very wrong. Don't close the game. At the end, catch its normal balls to send them back. Hit it <b>12 times</b> to win! If it gets you, you start again from wave 1.` },
];
const STORY_W1 = 10, STORY_W2 = 20, STORY_W3 = 30, STORY_W4 = 40, STORY_VERSION = 3;   // 3: the reset also re-locks the story packs
const STORY_BOTS = { 1: ["easy", "easy", "easy"], 11: ["medium", "hard", "hard"], 21: ["hard", "medium", "medium"] };   // levels that are normal games against bots

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
  if (id && id.startsWith("dia_")) return "diamond";
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
const OG = { USERS: ["dooomm", "kythor", "cookie_clicker", "imsmaat"], GAMES: 50, WINS: 10, COST: 1000 };
// ---- Announcements (admin panel). Temp ones last 10 seconds; long ones get their own tab until their timer ends or the admin stops them.
// kythor unlocks the Announcements tab with a quest: the OG skin quest, but twice the wins.
const ANN = { TEMP_MS: 10000, TEMP_MAX: 200, TITLE_MAX: 60, LONG_MAX: 1500, MAX_LONG: 5, MIN_MINUTES: 1, MAX_MINUTES: 60 * 24 * 30, GAMES: 50, WINS: 20, COST: 1000 };
// ---- Boss Rush (rogue-like): beat boss after boss; every level is harder. Needs World 3 beaten.
const ROGUE = { MAX: 250 };
function rogueReward(level) {             // points for beating a boss: 5 each, every 10th 50, every 100th 1000, level 250 10000 (the biggest one only)
  if (level >= 250 && level % 250 === 0) return 10000;
  if (level % 100 === 0) return 1000;
  if (level % 10 === 0) return 50;
  return 5;
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
  TEAM_STREAK: 3, TEAM_COOLDOWN: 3, BOUNTY_POINTS: 25, NEUTRALISE_COST: 5, WRATH_COST: 5, DEAL_COST: 500, BOARD_SLOTS: 100, TUTORIAL_VERSION: 3, PLACE_POINTS: [20, 15, 10, 5], STORY_POINTS: 20, BOARD_SLOT_COST: 100, WHATS_NEW: 2, ADMIN_USERNAME: "bajajhamish", HELPER_USERNAME: "kythor", MAX_PLAYERS: 6,
};

// ---- Level up system. Everyone starts at level 1. Each level has 3 quests; finish all 3, press Level Up.
// Quests get harder every level. No quest ever asks you to spend points directly.
// Level 10 matches the OG skin quest in size: play 50 games, win 10 matchmade Competitive games, open 20 packs (1000 points' worth).
// Level 20 needs a Mythical item traded away; levels 30, 40, 50 need more. Levels 25, 35, 45 need a Mythical pulled from a pack.
// A level never has more than one Mythical quest. Some levels have one-off quests (beat a Story level, win a High Risk game...).
// Level 50 is the last level with its own quests: after that every level repeats the level 50 quests, 15% harder each level.
const LEVEL = { MAX_UNIQUE: 50, GROWTH: 1.15 };
const LEVEL_STATS = {
  play:      { stat: "games",      base: 50,   min: 3,   w: 1,   icon: "🎮", text: n => `Play ${n} games` },
  compWin:   { stat: "compWins",   base: 10,   min: 1,   w: 1,   icon: "🏆", text: n => `Win ${n} matchmade Competitive game${n === 1 ? "" : "s"}` },
  elim:      { stat: "elims",      base: 40,   min: 5,   w: 1,   icon: "💥", text: n => `Get ${n} players out` },
  packs:     { stat: "packs",      base: 20,   min: 2,   w: 1,   icon: "🎁", text: n => `Open ${n} packs` },
  trade:     { stat: "trades",     base: 5,    min: 1,   w: 1,   icon: "🔁", text: n => `Complete ${n} trade${n === 1 ? "" : "s"} with other players` },
  hardWin:   { stat: "hardWins",   base: 8,    min: 1,   w: 1,   icon: "🤖", text: n => `Win ${n} Hard Bot Grind round${n === 1 ? "" : "s"}` },
  riskWin:   { stat: "riskWins",   base: 3,    min: 1,   w: 1,   icon: "🎲", text: n => `Win ${n} High Risk game${n === 1 ? "" : "s"}` },
  rares:     { stat: "rares",      base: 5,    min: 1,   w: 1,   icon: "💠", text: n => `Get ${n} Rare or better item${n === 1 ? "" : "s"} from packs` },
  superWin:  { stat: "superWins",  base: 5,    min: 1,   w: 1,   icon: "🤖", text: n => `Win ${n} Super Hard Bot Grind round${n === 1 ? "" : "s"}` },
  legends:   { stat: "legends",    base: 1,    min: 1,   w: 0.5, icon: "🌟", text: n => `Get ${n} Legendary or better item${n === 1 ? "" : "s"} from packs` },
  plat:      { stat: "plats",      base: 1,    min: 1,   w: 0.5, icon: "💎", text: n => `Make ${n} Platinum abilit${n === 1 ? "y" : "ies"}` },
  mythTrade: { stat: "mythTrades", base: 1,    min: 1,   w: 1,   icon: "🔮", text: n => `Trade away ${n} Mythical item${n === 1 ? "" : "s"}` },
  mythPull:  { stat: "mythPulls",  base: 1,    min: 1,   w: 1,   icon: "🔮", text: n => `Get ${n} Mythical item${n === 1 ? "" : "s"} from a pack` },
};
// one-off Story quests (checked against your beaten levels, not counted from the start of the level)
const LEVEL_STORY = { 5: [5, "Crossfire"], 8: [8, "Moving Target"], 15: [10, "The Boss"] };   // level -> [story level, its name]
function levelNice(n) { return n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 5) * 5 : Math.round(n); }
// the 3 quests for a level: [{ id, stat, target, text, icon, abs }]
function levelQuests(L) {
  L = Math.max(1, Math.floor(+L || 1));
  const e = Math.min(L, LEVEL.MAX_UNIQUE), extra = L > LEVEL.MAX_UNIQUE ? Math.pow(LEVEL.GROWTH, L - LEVEL.MAX_UNIQUE) : 1;
  const f = Math.max(0.2, Math.pow(e / 10, 1.2)) * extra;     // difficulty: 1.0 at level 10
  let ids;
  if (e === 10) ids = ["play", "compWin", "packs"];
  else if (e === 20) ids = ["compWin", "riskWin", "mythTrade"];
  else {
    const g1 = ["play", "compWin", "elim"][e % 3];
    const o2 = ["packs"]; if (e >= 3) o2.push("hardWin"); if (e >= 6) o2.push("trade"); if (e >= 8) o2.push("riskWin");
    const g2 = o2[(e + 1) % o2.length];
    const o3 = ["rares"]; if (e >= 6) o3.push("superWin"); if (e >= 12) o3.push("legends"); if (e >= 16) o3.push("plat");
    let g3 = o3[e % o3.length];
    if (e >= 30 && e % 10 === 0) g3 = "mythTrade";
    else if (e >= 25 && e % 10 === 5) g3 = "mythPull";
    ids = [g1, g2, g3];
    if (LEVEL_STORY[e]) ids[2] = "story";
  }
  return ids.map(id => {
    if (id === "story") {
      const [lv, name] = LEVEL_STORY[e];
      return { id, stat: "story" + lv, target: 1, text: lv === 10 ? "Beat the Story boss (level 10)" : `Beat Story level ${lv}: ${name}`, icon: "📖", abs: true };
    }
    const d = LEVEL_STATS[id];
    const n = id === "mythTrade" ? Math.max(1, Math.ceil(((e - 10) / 10) * extra - 1e-9))
      : id === "mythPull" ? Math.max(1, Math.ceil(extra - 1e-9))
      : Math.max(d.min, levelNice(d.base * d.w * f));
    return { id, stat: d.stat, target: n, text: d.text(n), icon: d.icon };
  });
}
// points for reaching a level: 100 x, where x = level / 5 rounded down (but rounded up when rounding down would give 0)
function levelReward(L) {
  const d = Math.max(1, Math.floor(+L || 1)) / 5, x = Math.floor(d) > 0 ? Math.floor(d) : Math.ceil(d);
  return 100 * x;
}

// ---- Level Maker (the World 4 reward). A level is a few settings packed into a share code (nothing is stored
// unless someone publishes it). Both the site and the server use these, and the server always re-checks a code.
const LMAKER = {
  TYPES: ["dodge", "catch", "boss"],
  LIMITS: { lanes: [3, 7], speed: [0.6, 1.4], waves: [3, 20], maxBalls: [1, 5], need: [3, 20], hp: [2, 15], bossWaves: [10, 40] },
  MODS: ["curve", "ghost", "bomb", "split", "glitch", "fake"],
  SLOTS: 3,                 // published levels per player
  NAME_MAX: 24,
  COST: 150,               // points to make a new level (editing it, playing it and publishing it are free)
  DRAFTS: 10,              // levels you can keep at once (delete one to make room)
  NEWEST: 50, TOP: 20,      // how many show in the Newest / Most liked lists
  PICKS: { owner: 3, helper: 2 },   // Admin's choice: 3 picked by bajajhamish, 2 by kythor
};
const lmClamp = (v, [a, b], d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
// turns whatever someone typed/sent into a safe level config the story engine can run
function levelClean(x) {
  x = x && typeof x === "object" ? x : {};
  const L = LMAKER.LIMITS, type = LMAKER.TYPES.includes(x.t) ? x.t : "dodge";
  const n = Math.round(lmClamp(x.l, L.lanes, 5)), top = n >= 6 ? 100 : n === 5 ? 110 : 150, bot = n >= 6 ? 540 : n === 5 ? 530 : 520;
  const mods = {}; LMAKER.MODS.forEach(k => { const v = Math.round(lmClamp(x.m && x.m[k], [0, 100], 0)); if (v) mods[k] = v / 100; });
  const out = { n: String(x.n || "Custom level").replace(/[<>&"]/g, "").slice(0, LMAKER.NAME_MAX) || "Custom level", t: type, l: n,
    s: Math.round(lmClamp(x.s, L.speed, 1) * 100) / 100, m: Object.keys(mods).length ? Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, Math.round(v * 100)])) : undefined,
    inv: x.inv ? 1 : 0, del: x.del ? 1 : 0 };
  const cfg = { type, lanes: [n, top, bot], start: Math.floor(n / 2), speed: out.s, enemy: out.n, mods: type === "catch" ? {} : mods, custom: out.n };
  if (type === "dodge") {
    out.w = Math.round(lmClamp(x.w, L.waves, 8)); out.b = Math.round(lmClamp(x.b, L.maxBalls, 3));
    const mx = Math.min(out.b, n - 1);
    cfg.waves = Array.from({ length: out.w }, (_, i) => Math.max(1, Math.min(mx, 1 + Math.floor(i * mx / out.w))));
  }
  if (type === "catch") {
    out.k = Math.round(lmClamp(x.k, L.need, 10)); cfg.need = out.k;
    cfg.normalMods = {}; if (mods.ghost) cfg.normalMods.ghost = mods.ghost; if (mods.curve) cfg.normalMods.curve = mods.curve;
  }
  if (type === "boss") {
    out.h = Math.round(lmClamp(x.h, L.hp, 5)); out.w = Math.round(lmClamp(x.w, L.bossWaves, 20)); out.b = Math.round(lmClamp(x.b, L.maxBalls, 4));
    Object.assign(cfg, { name: out.n, hp: out.h, waves: out.w, maxBalls: Math.min(out.b, n - 1), perStep: Math.max(1, Math.ceil(out.w / Math.min(out.b, n - 1))), look: "boss",
      hits: ["Ow!", "Hey!", "Stop!", "Grr…", "No!"], end: "You beat my level!" });
  }
  if (out.inv) cfg.invert = { every: 7000, for: 3500, warn: 1200 };
  if (out.del) cfg.del = { every: 7500, for: 3500, n: 1, warn: 1600 };
  return { cfg, data: out };
}
function b64(s) { return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64"); }
function unb64(s) { return typeof atob === "function" ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, "base64").toString("utf8"); }
// ---- "Build your own" levels (Level Maker v2): dots you move between, arrows for W/S, enemies anywhere.
//  Grid is 48 x 30 squares (20px each on a 960 x 640 screen, 20px from the top).
//  Code format: { v:2, n:name, p:[[x,y]..] dots, a:[next dot or -1 for each dot], st:start dot,
//    e:[{ n,x,y, m:[[x,y]..] path, ms:speed, r:ms between shots, wh:% white, a:"you"|"rand"|"pat", pt:[dot..], t:[[sec,text]..] }],
//    k: white catches to win (0 = survive instead), w: seconds to survive, l: lives, sp: ball speed, i: intro line }
const ARENA = { GX: 48, GY: 30, DOTS: 16, ENEMIES: 6, WPTS: 6, LINES: 4, LINE_MAX: 60, PAT: 12, CLEAR: 2,
  LIMITS: { k: [0, 30], w: [10, 300], l: [1, 5], sp: [0.6, 1.6], ms: [0, 8], r: [500, 6000], wh: [0, 100] } };
const arenaPx = (x, y) => [x * 20, 20 + y * 20];
function segDist(p, a, b) {                  // distance from point p to the line a-b (grid squares)
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function arenaClean(x) {
  x = x && typeof x === "object" ? x : {};
  const A = ARENA, L = A.LIMITS, int = (v, lo, hi, d) => Math.round(lmClamp(v, [lo, hi], d));
  const pt = q => Array.isArray(q) ? [int(q[0], 0, A.GX, 0), int(q[1], 0, A.GY, 0)] : null;
  const txt = (s, n) => String(s || "").replace(/[<>&"]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const dots = [];
  (Array.isArray(x.p) ? x.p : []).slice(0, A.DOTS).forEach(q => { const d = pt(q); if (d && dots.every(o => Math.hypot(o[0] - d[0], o[1] - d[1]) >= 1.5)) dots.push(d); });
  if (!dots.length) dots.push([6, 15]);
  // arrows: every dot has at most one arrow out (W) and one arrow in (S)
  const next = dots.map(() => -1), taken = new Set();
  (Array.isArray(x.a) ? x.a : []).forEach((to, i) => { to = Math.round(Number(to)); if (i < dots.length && to >= 0 && to < dots.length && to !== i && !taken.has(to)) { next[i] = to; taken.add(to); } });
  const clear = q => dots.every(d => Math.hypot(d[0] - q[0], d[1] - q[1]) >= A.CLEAR);
  const enemies = [];
  (Array.isArray(x.e) ? x.e : []).slice(0, A.ENEMIES).forEach(e => {
    if (!e || typeof e !== "object") return;
    const at = pt([e.x, e.y]); if (!clear(at)) return;              // enemies can't stand on your dots
    const path = [at];
    for (const q of (Array.isArray(e.m) ? e.m : []).slice(0, A.WPTS)) {  // ...or walk through them
      const w = pt(q); if (!w || !clear(w) || dots.some(d => segDist(d, path[path.length - 1], w) < A.CLEAR)) break;
      path.push(w);
    }
    const aim = ["you", "rand", "pat"].includes(e.a) ? e.a : "you";
    const pat = (Array.isArray(e.pt) ? e.pt : []).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < dots.length).slice(0, A.PAT);
    enemies.push({ n: txt(e.n, 16) || "Enemy " + (enemies.length + 1), x: at[0], y: at[1], m: path.slice(1), ms: Math.round(lmClamp(e.ms, L.ms, 3) * 10) / 10,
      r: int(e.r, L.r[0], L.r[1], 2000), wh: int(e.wh, 0, 100, 40), a: aim === "pat" && !pat.length ? "you" : aim, pt: aim === "pat" ? pat : [],
      t: (Array.isArray(e.t) ? e.t : []).slice(0, A.LINES).map(l => Array.isArray(l) ? [int(l[0], 0, 600, 0), txt(l[1], A.LINE_MAX)] : null).filter(l => l && l[1]) });
  });
  if (!enemies.length) enemies.push({ n: "Enemy 1", x: 40, y: 15, m: [], ms: 0, r: 2000, wh: 40, a: "you", pt: [], t: [] });
  if (!clear([enemies[0].x, enemies[0].y])) { enemies[0].x = 46; enemies[0].y = 2; }
  return { v: 2, n: txt(x.n, LMAKER.NAME_MAX) || "Custom level", p: dots, a: next, st: int(x.st, 0, dots.length - 1, 0), e: enemies,
    k: int(x.k, 0, 30, 5), w: int(x.w, 10, 300, 45), l: int(x.l, 1, 5, 3), sp: Math.round(lmClamp(x.sp, L.sp, 1) * 100) / 100, i: txt(x.i, A.LINE_MAX) };
}
// where an enemy is after ms milliseconds: walks its path and back again (ping-pong)
function arenaPos(e, ms) {
  const pts = [[e.x, e.y], ...(e.m || [])];
  if (pts.length < 2 || !e.ms) return pts[0];
  const seg = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  if (!tot) return pts[0];
  let s = (ms / 1000 * e.ms) % (2 * tot); if (s > tot) s = 2 * tot - s;
  for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, s / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } s -= seg[i]; }
  return pts[0];
}
function levelToCode(x) { const d = x && x.v === 2 ? arenaClean(x) : levelClean(x).data; return "CC4-" + b64(JSON.stringify(d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function levelFromCode(code) {        // null if it isn't a real level code
  try {
    code = String(code || "").trim();
    // a real code ends in ".signature": the server signs every level you save, so only paid-for levels work
    const m = /^CC4-([A-Za-z0-9_-]{8,6000})(?:\.([A-Za-z0-9_-]{16,64}))?$/.exec(code); if (!m) return null;
    const raw = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const x = JSON.parse(unb64(raw + "===".slice((raw.length + 3) % 4)));
    const out = x && x.v === 2 ? (d => ({ data: d, cfg: { type: "arena", custom: d.n, arena: d } }))(arenaClean(x)) : levelClean(x);
    out.body = m[1]; out.sig = m[2] || null;
    return out;
  } catch (e) { return null; }
}
// ---- Daily minigame: one each day (changes at midnight Canberra time), in this order. Admins can pick the next one.
const MINI = {
  ORDER: ["color", "ultra", "duel", "tag", "clicker"],
  NAMES: { color: "Color Mode", ultra: "Ultra Boss", duel: "Dodgeball", tag: "Buildups", clicker: "Idle Clicker" },
  ICONS: { color: "🎨", ultra: "🐉", duel: "🔴", tag: "🧟", clicker: "🟦" },
  DESC: {
    color: "A colour is called out. Get onto that colour before the timer runs out, or you're out. It gets faster every round. Everyone still in at the end gets 30 points.",
    ultra: "Everyone in the game against one giant boss. Doors open at 11:15 am (Canberra time), the boss attacks from 11:20 to 11:30 am. Get hit once and you're out. Everyone still standing at 11:30 gets 120 points.",
    duel: "1 on 1, one ball. Throw it down your lane, dodge theirs. The lanes shrink and the ball gets faster. Winner gets 50 points.",
    tag: "One random player is IT. Get touched and you're IT too. Last one standing wins 100 points. Stay to the end: +10 (+20 for whoever started as IT). Leave mid-game: -5 (-10 for the first IT).",
    clicker: "Click to make squares and buy upgrades that make more. Whoever has the most squares at midnight wins 500 points. Squares don't carry over to next time.",
  },
  SLOTS: { color: 8, tag: 8, duel: 2 },
  COLOR_PTS: 30, ULTRA_PTS: 120, DUEL_PTS: 50, TAG_WIN: 100, TAG_STAY: 10, TAG_IT_STAY: 20, TAG_LEAVE: 5, TAG_IT_LEAVE: 10, CLICK_WIN: 500,
  ULTRA_JOIN: [11, 15], ULTRA_START: [11, 20], ULTRA_END: [11, 30],
  CLICK_UPGRADES: {
    click:   { name: "Bigger clicks", cost: 25,    grow: 1.55, desc: "+1 square per click" },
    auto:    { name: "Auto square",   cost: 60,    grow: 1.6,  desc: "+1 square every second" },
    factory: { name: "Square factory", cost: 1500, grow: 1.75, desc: "+15 squares every second" },
    mega:    { name: "Mega factory",  cost: 25000, grow: 1.9,  desc: "+200 squares every second" },
  },
};
function clickCost(item, lv) { const u = MINI.CLICK_UPGRADES[item]; return Math.round(u.cost * Math.pow(u.grow, lv || 0)); }
