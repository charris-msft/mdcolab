/**
 * Generates creative, friendly display names for anonymous users.
 * Format: "adjective-animal" — e.g., "fuzzy-caterpillar", "playful-otter".
 * Persists in localStorage so the same user keeps their name across visits.
 *
 * Each guest also gets a stable `anonId` (UUID) so we can find all their
 * comments later for cascading rename.
 */

const adjectives = [
  "fuzzy", "playful", "curious", "friendly", "gentle",
  "brave", "clever", "cozy", "daring", "eager",
  "fancy", "graceful", "happy", "jolly", "kind",
  "lively", "merry", "noble", "peppy", "quirky",
  "radiant", "snappy", "sparkly", "swift", "witty",
  "zesty", "breezy", "dreamy", "fluffy", "sunny",
  "calm", "bold", "nimble", "plucky", "warm",
  "sneaky", "wise", "spunky", "mellow", "chirpy",
  "rusty", "shiny", "bouncy", "wiggly", "snazzy",
];

const animals = [
  "caterpillar", "otter", "fox", "panda", "owl",
  "bunny", "koala", "dolphin", "hedgehog", "kitten",
  "puppy", "duckling", "seal", "squirrel", "raccoon",
  "flamingo", "parrot", "sloth", "chameleon", "capybara",
  "quokka", "axolotl", "narwhal", "alpaca",
  "puffin", "chinchilla", "gecko", "hamster", "starfish",
  "platypus", "wombat", "manatee", "lemur", "ferret",
  "hummingbird", "tapir", "octopus", "marmot", "pangolin",
];

const NAME_KEY = "mdcolab-guest-name";
const ANON_ID_KEY = "mdcolab-guest-anon-id";

function generateFriendlyName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}-${animal}`;
}

function generateAnonId(): string {
  // Lightweight UUID v4 — no crypto.randomUUID dependency for older browsers
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "anon-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Get or create a friendly anonymous display name, persisted in localStorage. */
export function getGuestDisplayName(): string {
  if (typeof window === "undefined") return generateFriendlyName();
  const stored = localStorage.getItem(NAME_KEY);
  if (stored) return stored;
  const name = generateFriendlyName();
  localStorage.setItem(NAME_KEY, name);
  return name;
}

/** Update the stored guest display name. */
export function setGuestDisplayName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

/** Generate a new random name (for "randomize" button). */
export function randomizeGuestName(): string {
  const name = generateFriendlyName();
  if (typeof window !== "undefined") {
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

/**
 * Get or create a stable anonymous ID for this browser.
 * Used to identify all comments by the same guest user for cascading rename.
 */
export function getGuestAnonId(): string {
  if (typeof window === "undefined") return generateAnonId();
  const stored = localStorage.getItem(ANON_ID_KEY);
  if (stored) return stored;
  const id = generateAnonId();
  localStorage.setItem(ANON_ID_KEY, id);
  return id;
}
