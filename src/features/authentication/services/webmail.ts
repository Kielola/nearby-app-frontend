/**
 * Opening the user's email inbox, which the web cannot actually do.
 *
 * ## The bug this replaces
 *
 * The verification screen had a button labelled "Open Email App" wired to:
 *
 *     window.location.href = "mailto:";
 *
 * A `mailto:` with no recipient does NOT open the inbox. It opens the mail
 * client in COMPOSE mode — a blank new message, addressed to nobody. Users tapped
 * "Open Email App" expecting their inbox and got an empty draft, which reads as
 * the app creating an email on their behalf. There is no HTML API to open an
 * inbox; `mailto:` is the closest-looking thing and it does something else
 * entirely.
 *
 * ## What this does instead
 *
 * Links to the web version of the provider the user actually registered with.
 * Gmail, Outlook, Yahoo and iCloud all register universal links / app links for
 * their web URLs, so on a phone `https://mail.google.com` opens the Gmail app
 * rather than a browser tab. It is not a guaranteed deep link on every device,
 * but it always lands somewhere useful, and it is never a blank draft.
 *
 * When the provider is not one we recognise — a work domain, a self-hosted
 * server — this returns null and the caller shows plain instructions instead of a
 * button that would do the wrong thing.
 */

export interface WebmailTarget {
  /** What to call the button: "Open Gmail". */
  label: string;
  url: string;
}

const PROVIDERS: { label: string; domains: string[]; prefixes?: string[]; url: string }[] = [
  {
    label: 'Open Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    url: 'https://mail.google.com',
  },
  {
    label: 'Open Yahoo Mail',
    domains: ['ymail.com', 'rocketmail.com'],
    prefixes: ['yahoo.'],
    url: 'https://mail.yahoo.com',
  },
  {
    label: 'Open Outlook',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    prefixes: ['outlook.', 'hotmail.'],
    url: 'https://outlook.live.com/mail',
  },
  {
    label: 'Open iCloud Mail',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    url: 'https://www.icloud.com/mail',
  },
  {
    label: 'Open Proton Mail',
    domains: ['protonmail.com', 'proton.me'],
    url: 'https://mail.proton.me',
  },
];

/** The provider's inbox URL for this address, or null if we do not know it. */
export function webmailTargetFor(email: string | null | undefined): WebmailTarget | null {
  const domain = (email ?? '').split('@')[1]?.trim().toLowerCase();
  if (!domain) return null;

  for (const provider of PROVIDERS) {
    if (provider.domains.includes(domain)) return { label: provider.label, url: provider.url };
    if (provider.prefixes?.some((prefix) => domain.startsWith(prefix))) {
      return { label: provider.label, url: provider.url };
    }
  }

  return null;
}

/** "ada@example.com" -> "ada@example.com". Trimmed, or null when unknown. */
export function displayEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? '').trim();
  return trimmed || null;
}
