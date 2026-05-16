/**
 * Procedural name generator wrappers around `fantastical`.
 *
 * Use cases in Long Watch:
 *   - Background commoners (dock-workers, watchmen) without hand-naming.
 *   - Procedural assassin party leaders for the "mooks" AssassinId.
 *   - Player-chosen character name fallback ("Random" button).
 *   - Faction display names (mystic orders, guilds) for clue text.
 */
import * as fantastical from 'fantastical';

export type NameSpecies =
  | 'human' | 'highelf' | 'elf' | 'dwarf' | 'halfling'
  | 'gnome' | 'orc' | 'goblin' | 'demon' | 'drow' | 'angel';

export type NameGender = 'male' | 'female';

/** Random human name (used for commoners / generic NPCs). */
export function commonerName(allowMultipleNames = false): string {
  return String(fantastical.human({ allowMultipleNames }));
}

/** Generic species + gender wrapper. Falls back to human if species unknown. */
export function speciesName(species: NameSpecies, gender: NameGender = 'male'): string {
  const lib = fantastical as unknown as Record<string, (g?: NameGender) => string>;
  const fn = lib[species];
  try {
    if (typeof fn === 'function') {
      // Some generators (goblin, orc, demon) take no args; rest take gender.
      const noArg = species === 'goblin' || species === 'orc' || species === 'demon';
      return String(noArg ? (fn as () => string)() : fn(gender));
    }
  } catch {}
  return commonerName();
}

/** A random tavern / inn name (flavor for dialogue and clue text). */
export function tavernName(): string {
  try { return String((fantastical as { tavern?: () => string }).tavern?.() ?? 'The Anchor'); }
  catch { return 'The Anchor'; }
}

/** A random guild / mystic-order name (faction flavor). */
export function guildName(): string {
  try { return String((fantastical as { guild?: () => string }).guild?.() ?? 'Anonymous Hand'); }
  catch { return 'Anonymous Hand'; }
}

/** Bundle of N commoner NPCs with random gendered human names. */
export function commonerParty(n: number): { name: string; gender: NameGender }[] {
  const out: { name: string; gender: NameGender }[] = [];
  for (let i = 0; i < n; i++) {
    const gender: NameGender = Math.random() < 0.5 ? 'male' : 'female';
    out.push({ name: commonerName(), gender });
  }
  return out;
}
