// copy of server/src/profanity.js for the website (the server checks again anyway)
const badName = (() => {
// ======================================================================
//  profanity.js: cleans chat messages on the server (so nobody can skip it)
//  Swear words and slurs become ***. Catches l33t speak (sh1t), symbols
//  (f*ck), repeated letters (fuuuck) and spaced letters (f u c k).
// ======================================================================
// matched anywhere inside a word
const ANYWHERE = ["fuck", "fuk", "fck", "fuq", "shit", "sht", "bitch", "biatch", "cunt", "nigg", "nigr", "faggot", "fagot", "dick", "cock", "pussy", "puss1",
  "whore", "slut", "bastard", "wank", "twat", "retard", "motherf", "asshole", "arsehole", "dildo", "porn", "penis", "vagina", "boob", "tits", "jizz",
  "cum", "rape", "nazi", "hitler", "kys", "killyourself", "paki", "chink", "spic", "kike", "tranny", "dyke", "bollock", "prick", "douche", "skank"];
// only matched as a whole word (so "class", "assist", "hello", "scrap", "shell" stay fine)
const WHOLE = ["ass", "arse", "fag", "hell", "crap", "damn", "piss", "sex", "nig", "coon", "hoe", "ho", "tit", "bum", "wtf", "stfu", "fu", "homo", "lesbo"];
// words that contain a bad bit but are fine
const SAFE = ["cocktail", "peacock", "hancock", "scunthorpe", "dickens", "cumulative", "cumulus", "document", "cucumber", "circumstance", "accumulate", "therapist",
  "grape", "drape", "scrape", "skunk", "spicy", "shitake", "shiitake", "titan", "title", "titanium", "constitution", "button", "bumblebee", "pakistan", "assassin"];
const LEET = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b", "9": "g", "(": "c", "*": "u", "#": "h" };

function leet(w) { return w.toLowerCase().split("").map(c => LEET[c] || c).join("").replace(/[^a-z]/g, ""); }
function norm(w) { return leet(w).replace(/(.)\1+/g, "$1"); }           // fuuuuck -> fuck
// each bad word as a pattern where every letter can be repeated: "boob" matches "booooob" but NOT "bob"
const ANY_RX = ANYWHERE.map(b => new RegExp(b.split("").map(c => c + "+").join("")));
function bad(word) {
  const n = norm(word); if (!n) return false;
  const raw = word.toLowerCase().replace(/[^a-z]/g, "");
  if (SAFE.some(s => raw.includes(s) && raw.length <= s.length + 2)) return false;
  if (WHOLE.includes(n) || WHOLE.includes(raw)) return true;
  const l = leet(word);
  return ANY_RX.some(rx => rx.test(l));
}
function cleanChat(input) {
  let text = String(input == null ? "" : input).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\ufeff]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!text) return "";
  // spaced-out letters: "f u c k" / "f.u.c.k" -> check them joined together
  text = text.replace(/\b(?:[a-zA-Z0-9@$*!][ ._\-]){2,}[a-zA-Z0-9@$*!]\b/g, m => { const j = m.replace(/[ ._\-]/g, ""); return bad(j) ? "*".repeat(j.length) : m; });
  return text.split(/(\s+)/).map(w => (/\s/.test(w) || !bad(w)) ? w : (w.length > 1 ? w[0] + "*".repeat(w.length - 1) : "*")).join("");
}
// usernames: check each part between underscores/numbers, and the whole thing joined up
function badName(name) {
  const s = String(name || "").toLowerCase();
  const parts = s.split(/[_\s]+/).filter(Boolean);
  if (parts.some(bad)) return true;
  // joined up only when it looks split on purpose (f_u_c_k, sh_it)
  const joined = parts.join("");
  return parts.length > 1 && parts.some(x => x.length <= 2) && bad(joined);
}

return badName;
})();
