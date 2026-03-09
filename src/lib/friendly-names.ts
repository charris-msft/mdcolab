/**
 * Generates cute, friendly display names for anonymous users.
 * Format: "Adjective Animal" — e.g., "Cheerful Penguin", "Playful Otter"
 * Stored in localStorage so the same user keeps their name across visits.
 */

const adjectives = [
  "Cheerful", "Playful", "Curious", "Friendly", "Gentle",
  "Brave", "Clever", "Cozy", "Daring", "Eager",
  "Fancy", "Graceful", "Happy", "Jolly", "Kind",
  "Lively", "Merry", "Noble", "Peppy", "Quirky",
  "Radiant", "Snappy", "Sparkly", "Swift", "Witty",
  "Zesty", "Breezy", "Dreamy", "Fluffy", "Sunny",
  "Calm", "Bold", "Nimble", "Plucky", "Warm",
];

const animals = [
  "Penguin", "Otter", "Fox", "Panda", "Owl",
  "Bunny", "Koala", "Dolphin", "Hedgehog", "Kitten",
  "Puppy", "Duckling", "Seal", "Squirrel", "Raccoon",
  "Flamingo", "Parrot", "Sloth", "Chameleon", "Capybara",
  "Quokka", "Axolotl", "Red Panda", "Narwhal", "Alpaca",
  "Puffin", "Chinchilla", "Gecko", "Hamster", "Starfish",
];

const STORAGE_KEY = "mdcolab-guest-name";

function generateFriendlyName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
}

/** Get or create a friendly anonymous display name, persisted in localStorage. */
export function getGuestDisplayName(): string {
  if (typeof window === "undefined") return generateFriendlyName();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const name = generateFriendlyName();
  localStorage.setItem(STORAGE_KEY, name);
  return name;
}

/** Update the stored guest display name. */
export function setGuestDisplayName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, name);
}

/** Generate a new random name (for "randomize" button). */
export function randomizeGuestName(): string {
  const name = generateFriendlyName();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, name);
  }
  return name;
}
