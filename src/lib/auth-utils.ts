/**
 * Checks if a GitHub username matches the EMU (Enterprise Managed User) naming pattern.
 * EMU usernames follow the format `login_shortcode` where shortcode is
 * a lowercase alphabetic enterprise identifier (2+ chars).
 */
export function isEmuUsername(username: string): boolean {
  const parts = username.split("_");
  if (parts.length !== 2) return false;
  const [login, shortcode] = parts;
  if (login.length === 0 || shortcode.length < 2) return false;
  return /^[a-z]+$/.test(shortcode);
}
