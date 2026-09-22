/**
 * The Nearby Terms of Service — FashFOS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DO NOT EDIT THE TEXT BELOW EXCEPT TO FILL THE PLACEHOLDERS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `TERMS_BODY` is the agreement exactly as FashFOS supplied it. It is rendered
 * verbatim: not summarised, not re-wrapped, not reordered, not trimmed. A service
 * agreement is the specific text that was agreed to, so editing it — even for
 * presentation — changes what every user consented to.
 *
 * The renderer finds sections by matching lines of the form `N. TITLE` where the
 * title is upper-case, which is how this document is written. Numbered list
 * items inside sections start lower-case, so they are not mistaken for headings.
 * The text therefore needs no markdown decoration to render correctly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE PLACEHOLDERS REMAIN — REPLACE BEFORE LAUNCH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   [INSERT OFFICIAL EMAIL]              → the address users can actually reach
 *   [INSERT FULL REGISTERED LEGAL NAME]  → the company as registered
 *   [INSERT REGISTERED OFFICE]           → the registered address
 *
 * An agreement naming no counterparty and no contact address is materially
 * weaker than one that does.
 *
 * `TERMS_ARE_PLACEHOLDER` below does NOT block on these three — only on the body
 * being missing entirely. Fill them in, but they are not a hard gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGING THE AGREEMENT LATER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bump `TERMS_VERSION` whenever the text changes. Every user whose stored
 * acceptance is on an older version is then asked to agree again. If you edit
 * the text without bumping the version, existing users are treated as having
 * agreed to something they never saw.
 *
 * `TERMS_VERSION` must stay in `YYYY-MM-DD` form — the backend validates the
 * string against that pattern so an arbitrary value cannot reach the record.
 */

export const TERMS_VERSION = '2026-08-30';

/** Shown in the consent header. */
export const TERMS_EFFECTIVE_DATE = '30th August, 2026';
export const TERMS_LAST_UPDATED = '30th August, 2026';

/** The site this agreement governs. */
export const TERMS_SITE = 'nearby.fashfos.com';

/** Governing law, stated once here so the rendered footer cannot drift from it. */
export const TERMS_GOVERNING_LAW = 'Federal Republic of Nigeria';

/** The section the user must acknowledge separately. */
export const FINAL_SECTION_NUMBER = 34;

/** Placeholders the user still needs to fill in. */
export const TERMS_PLACEHOLDERS = [
  '[INSERT OFFICIAL EMAIL]',
  '[INSERT FULL REGISTERED LEGAL NAME]',
  '[INSERT REGISTERED OFFICE]',
] as const;

/**
 * The agreement. Verbatim.
 *
 * Everything between the backticks is the document as supplied.
 */
export const TERMS_BODY = `NEARBY / FASHFOS

TERMS OF SERVICE

Effective Date: [30th August, 2026]

Last Updated: [30th August, 2026]

These Terms of Service (“Terms”) constitute a legally binding agreement between you (“User”, “you” or “your”) and FashFOS (“FashFOS”, “Nearby”, “Company”, “we”, “us” or “our”) concerning your access to and use of the Nearby application, website, software, services, features and related products (collectively, the “Platform”).

By creating an account, accessing, browsing or using the Platform, clicking “I Agree”, purchasing a subscription, submitting information to us, or otherwise using any part of the Platform, you acknowledge that you have read, understood and agreed to be legally bound by these Terms and our Privacy Policy.

IF YOU DO NOT AGREE TO THESE TERMS, DO NOT CREATE AN ACCOUNT OR USE THE PLATFORM.

---

1. ABOUT NEARBY

Nearby is a technology platform designed to facilitate social discovery, communication, proximity-based interactions, community participation and other related digital experiences.

Nearby provides technology and communication tools. Nearby does not guarantee, endorse, insure, supervise, employ, control, investigate, certify or assume responsibility for the identity, character, intentions, conduct, statements, representations, qualifications, financial status, criminal history, safety or reliability of any User.

Unless expressly stated otherwise, Users are independent individuals using the Platform for their own purposes.

FashFOS is not a dating agency, security company, private investigator, emergency-response service, transportation provider, medical service, law-enforcement agency, financial institution or guarantor of any User.

---

2. ELIGIBILITY

You may use the Platform only if you are legally capable of entering into a binding agreement under applicable law and satisfy any minimum-age requirement specified by FashFOS.

FashFOS reserves the right to establish, change or impose additional age, identity, verification or eligibility requirements for particular features.

You must provide truthful and accurate information when creating an account.

You must not create an account using another person's identity, photograph, name, telephone number, email address or other identifying information without lawful authority.

We may request information reasonably necessary to verify your identity, eligibility or compliance with these Terms.

---

3. ACCOUNT RESPONSIBILITY

You are responsible for maintaining the confidentiality and security of your account credentials and for activity occurring through your account, except to the extent caused by circumstances for which you are not legally responsible.

You must notify FashFOS promptly if you believe that:

- your account has been accessed without authorization;
- your password or authentication credentials have been compromised;
- someone is impersonating you;
- your personal information has been misused; or
- your account is being used for unlawful purposes.

You must not sell, rent, transfer, share or otherwise provide your account to another person without our written authorization.

FashFOS may suspend or restrict an account where we reasonably believe that the account has been compromised, misused, fraudulent or involved in prohibited conduct.

---

4. USER CONDUCT

You agree to use Nearby lawfully, responsibly and respectfully.

You must not use the Platform to:

1. commit, facilitate, encourage or threaten any crime or unlawful act;
2. harass, stalk, threaten, intimidate or abuse another person;
3. impersonate another person or organization;
4. create fraudulent, deceptive or misleading accounts;
5. engage in scams, fraud, extortion, blackmail or financial exploitation;
6. solicit money from Users through deception or coercion;
7. distribute malware, viruses or malicious software;
8. attempt to obtain another User's password or authentication information;
9. collect personal information about Users without lawful authorization;
10. expose another person's private information;
11. engage in sexual exploitation or abuse;
12. exploit, groom or endanger children or vulnerable persons;
13. facilitate trafficking or other exploitation;
14. promote violence or credible threats of violence;
15. distribute unlawful content;
16. engage in discriminatory or hateful conduct prohibited by applicable law;
17. upload content that infringes another person's intellectual-property rights;
18. use automated systems, bots or scraping tools without authorization;
19. interfere with Platform security or functionality;
20. circumvent account restrictions or bans;
21. manipulate location or proximity information for deceptive or harmful purposes;
22. use the Platform for unlawful commercial solicitation;
23. conduct activities that create unreasonable safety risks for other Users; or
24. otherwise violate applicable Nigerian law or any other law applicable to your use of the Platform.

FashFOS may determine, acting reasonably and subject to applicable law, whether conduct violates these Terms or creates a risk to the Platform or its Users.

---

5. USER-GENERATED CONTENT

Users may be permitted to submit, upload, publish, transmit or otherwise make available photographs, videos, text, audio, profile information, comments, messages, reviews and other material (“User Content”).

You retain ownership of User Content to the extent that you legally own it.

However, by submitting User Content to the Platform, you grant FashFOS a non-exclusive, worldwide, royalty-free, transferable and sublicensable licence, to the extent reasonably necessary to operate, maintain, improve, promote, secure and provide the Platform and its services.

This licence does not give FashFOS unrestricted ownership of your personal content.

You represent and warrant that:

- you have the rights necessary to submit the User Content;
- your User Content does not unlawfully infringe another person's rights;
- you have obtained any required permissions concerning identifiable persons appearing in the content; and
- the content does not violate these Terms or applicable law.

You remain responsible for your User Content.

---

6. CONTENT MODERATION

FashFOS does not guarantee that every item of User Content will be reviewed before it becomes available to other Users.

We may, but are not obligated to:

- review content;
- investigate reports;
- remove or restrict content;
- limit distribution or visibility;
- issue warnings;
- suspend accounts;
- permanently terminate accounts;
- preserve relevant records where legally permitted or required; and
- report suspected unlawful activity to appropriate authorities.

Our failure to detect, remove or prevent particular content or conduct does not constitute an endorsement of that content or conduct and does not create an obligation to monitor every User or interaction.

---

7. USER-TO-USER INTERACTIONS

YOU ARE SOLELY RESPONSIBLE FOR YOUR DECISIONS CONCERNING OTHER USERS.

FashFOS does not guarantee that any User is:

- who they claim to be;
- trustworthy;
- honest;
- safe;
- free from criminal history;
- financially responsible;
- mentally or physically capable of participating safely;
- suitable for friendship, dating, business or any other relationship; or
- acting in good faith.

Any profile badge, verification indicator, trusted-user designation, rating, reputation score or similar feature is not a guarantee of identity, character, safety or future conduct.

Users must exercise their own judgment and take appropriate precautions.

---

8. MEETUPS AND OFF-PLATFORM INTERACTIONS

Nearby may allow Users to discover or communicate with other Users and may provide features intended to assist Users in planning social interactions or meetups.

FashFOS does not organize, supervise, guarantee or insure physical meetings between Users unless expressly stated otherwise in a specific paid service agreement.

If you choose to meet another User physically, you do so voluntarily and at your own discretion and risk.

We strongly encourage Users to:

- meet initially in public places;
- tell a trusted person where they are going;
- maintain control over their transportation;
- avoid sharing unnecessary personal information;
- avoid carrying unnecessary valuables;
- avoid accepting unknown substances or drinks;
- leave immediately if they feel unsafe; and
- contact appropriate emergency services where necessary.

FashFOS is not responsible for injuries, theft, assault, fraud, harassment, kidnapping, disappearance, property damage, emotional distress, death or other harm arising from an interaction between Users, except to the extent liability cannot lawfully be excluded under applicable law.

Nothing in these Terms prevents a User from reporting suspected criminal conduct to law-enforcement authorities.

---

9. PROXIMITY AND LOCATION SERVICES

Nearby may use device location, GPS, network-based location or other location technologies to provide proximity-based features.

Location information may be inaccurate, delayed, unavailable, degraded, manipulated or affected by device settings, network conditions, atmospheric conditions, third-party systems or other technical limitations.

Nearby does not guarantee that displayed distances, locations, directions, positions or proximity information are accurate, complete or current.

A displayed distance must not be treated as proof that a person is physically located at a particular address or place.

Nearby is not an emergency-location service.

DO NOT RELY ON NEARBY FOR EMERGENCY RESPONSE, PERSONAL SECURITY, RESCUE, MEDICAL ASSISTANCE OR LAW-ENFORCEMENT RESPONSE.

Users are responsible for controlling the location information they choose to share, subject to the Platform's available settings and applicable law.

---

10. THIRD-PARTY MAPS, LOCATION AND OTHER SERVICES

The Platform may rely on third-party technologies and services, including mapping, geolocation, cloud infrastructure, authentication, payment processing, communications and analytics providers.

Third-party services may be subject to separate terms and privacy policies.

FashFOS does not guarantee the availability, accuracy, reliability, security or continued operation of third-party services.

A failure of a third-party service may cause some Platform features to become unavailable or inaccurate.

---

11. MESSAGES AND COMMUNICATIONS

Nearby may provide messaging and communication functionality.

Users are responsible for the messages and communications they send.

FashFOS does not guarantee that communications between Users will always be private, delivered, uninterrupted, error-free or available.

We may process, preserve, review or disclose communications or related technical information where permitted or required by applicable law, including for security, abuse prevention, fraud prevention, legal compliance, investigation or enforcement of these Terms.

Users must not use messaging features for unlawful activity.

---

12. SAFETY REPORTING

Users may report suspected abuse, harassment, fraud, impersonation, dangerous behavior, unlawful activity or other violations through available reporting mechanisms.

A report does not guarantee that FashFOS will take a particular action.

FashFOS may take whatever lawful and proportionate action it considers appropriate based on available information.

Where appropriate or legally required, FashFOS may cooperate with law-enforcement agencies, regulators, courts or other competent authorities.

---

13. NO BACKGROUND-CHECK GUARANTEE

Unless FashFOS expressly states otherwise for a particular service, FashFOS does not conduct comprehensive criminal, financial, employment, educational, identity or background checks on Users.

Any verification process we provide may only verify particular information or attributes and should not be interpreted as a comprehensive background investigation.

---

14. INTELLECTUAL PROPERTY

The Platform, including its software, design, interface, branding, logos, trademarks, graphics, databases, functionality, text, code and other materials provided by FashFOS, are owned by or licensed to FashFOS and are protected by applicable intellectual-property laws.

Except as expressly permitted by FashFOS or applicable law, you must not:

- copy;
- reproduce;
- modify;
- distribute;
- sell;
- lease;
- reverse engineer;
- decompile;
- extract;
- scrape;
- create derivative works from; or
- commercially exploit

any part of the Platform.

“Nearby”, “FashFOS” and associated logos, names and marks are trademarks or branding assets of FashFOS or their respective owners.

---

15. PAYMENTS AND SUBSCRIPTIONS

Certain Platform features may require payment.

Prices, billing periods, subscription features and applicable taxes will be displayed before purchase.

Where a recurring subscription is offered, you authorize the applicable payment provider to charge the applicable subscription amount according to the selected billing cycle until the subscription is cancelled or otherwise terminated.

FashFOS may change subscription prices prospectively, subject to applicable law and any notice requirements.

Cancellation, refunds and consumer remedies are subject to the applicable subscription terms, payment-provider rules and mandatory consumer-protection laws.

Nothing in these Terms is intended to unlawfully remove or restrict any consumer refund, cancellation or other statutory right.

---

16. FREE TRIALS, PROMOTIONS AND REFERRALS

FashFOS may offer promotions, competitions, referral programmes, bonuses or other incentives.

Each promotion may have additional rules.

FashFOS may disqualify accounts involved in fraud, manipulation, multiple-account abuse, automated activity, self-referrals or other attempts to unfairly obtain promotional benefits.

Unless expressly stated otherwise, promotional benefits have no cash value and are not transferable.

FashFOS reserves the right to modify, suspend or terminate a promotion where reasonably necessary, including because of fraud, technical problems, legal requirements or circumstances outside our reasonable control.

---

17. AVAILABILITY OF THE PLATFORM

We aim to provide a reliable Platform but do not guarantee that the Platform will always be:

- available;
- uninterrupted;
- secure;
- error-free;
- compatible with every device;
- free from bugs;
- free from malicious attacks; or
- permanently available in every location.

The Platform may be suspended, modified or discontinued temporarily or permanently for maintenance, security, upgrades, business reasons, legal requirements, third-party failures or other circumstances.

---

18. SECURITY

FashFOS implements reasonable technical and organizational measures intended to protect the Platform and information processed through it.

However, no internet-connected system can be guaranteed to be completely secure.

You acknowledge that transmission and storage of information through digital systems carries inherent risks.

You must not attempt to compromise Platform security or exploit vulnerabilities.

---

19. PRIVACY AND PERSONAL DATA

Your use of the Platform is also governed by our Privacy Policy, which explains how FashFOS collects, uses, stores, shares and otherwise processes personal data.

The Privacy Policy forms part of these Terms by reference.

FashFOS will process personal data in accordance with applicable data-protection law.

Nothing in these Terms is intended to waive, remove or unlawfully restrict any mandatory data-protection right.

Where applicable, Users may have rights concerning access, correction, deletion, objection, restriction, portability, withdrawal of consent and other rights under applicable data-protection law.

---

20. DISCLAIMERS

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE PLATFORM AND ITS FEATURES ARE PROVIDED ON AN “AS AVAILABLE” AND “AS IS” BASIS.

FASHFOS DOES NOT WARRANT THAT:

- THE PLATFORM WILL MEET EVERY USER'S REQUIREMENTS;
- INFORMATION PROVIDED BY USERS IS ACCURATE;
- USERS ARE GENUINE OR SAFE;
- CONTENT IS ACCURATE OR RELIABLE;
- THE PLATFORM WILL BE UNINTERRUPTED;
- THE PLATFORM WILL BE FREE OF ERRORS OR SECURITY VULNERABILITIES;
- LOCATION INFORMATION WILL NOT ALWAYS BE ACCURATE;
- MEETUPS WILL BE SAFE;
- COMMUNICATIONS WILL ALWAYS BE DELIVERED;
- THIRD-PARTY SERVICES WILL REMAIN AVAILABLE; OR
- THE PLATFORM WILL PRODUCE A PARTICULAR SOCIAL, FINANCIAL OR PERSONAL RESULT.

TO THE EXTENT ANY WARRANTY, CONDITION OR RIGHT CANNOT LAWFULLY BE EXCLUDED, THIS SECTION DOES NOT EXCLUDE IT.

---

21. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FASHFOS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE OR CONSEQUENTIAL LOSS OR DAMAGE, INCLUDING LOSS OF PROFITS, BUSINESS, REVENUE, OPPORTUNITY, GOODWILL, DATA OR ANTICIPATED SAVINGS ARISING FROM OR RELATED TO YOUR USE OF THE PLATFORM.

FASHFOS SHALL NOT BE RESPONSIBLE FOR LOSS OR DAMAGE ARISING FROM:

- USER CONDUCT;
- USER CONTENT;
- USER-TO-USER INTERACTIONS;
- OFF-PLATFORM COMMUNICATIONS;
- PHYSICAL MEETUPS;
- THIRD-PARTY SERVICES;
- INACCURATE USER INFORMATION;
- LOCATION inaccuracies;
- unauthorized access caused by compromised user credentials;
- network failures;
- device failures;
- telecommunications failures;
- force majeure events; or
- conduct occurring outside FashFOS's reasonable control,

except to the extent that applicable law provides otherwise.

Where legally permissible, FashFOS's aggregate liability arising from a paid service shall not exceed the amount actually paid by the affected User to FashFOS for that service during the twelve (12) months immediately preceding the event giving rise to the claim.

Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited under applicable law, including liability arising from fraud, wilful misconduct or other liability that applicable law requires to remain enforceable.

---

22. INDEMNIFICATION

To the maximum extent permitted by law, you agree to indemnify and hold harmless FashFOS, its directors, officers, employees, contractors, affiliates and service providers against reasonable losses, liabilities, claims, damages, penalties, costs and expenses, including reasonable legal expenses, arising from or connected with:

1. your material breach of these Terms;
2. your unlawful use of the Platform;
3. your User Content;
4. your infringement of another person's rights;
5. your fraudulent or deceptive conduct;
6. your violation of applicable law; or
7. your unauthorized use of another person's personal information.

This indemnity does not apply to the extent that a claim results from FashFOS's own conduct for which liability cannot lawfully be excluded.

---

23. ACCOUNT SUSPENSION AND TERMINATION

FashFOS may suspend, restrict or terminate your account where:

- you materially breach these Terms;
- you engage in unlawful conduct;
- your account presents a security risk;
- your account is fraudulent or deceptive;
- you abuse other Users;
- you attempt to circumvent enforcement actions;
- you create unreasonable risks to the Platform or its community;
- required by law or lawful authority; or
- reasonably necessary to protect Users, FashFOS or the integrity of the Platform.

Where reasonably practicable and legally permissible, FashFOS may provide notice or an opportunity to address the issue.

You may stop using the Platform at any time and may request account deletion subject to applicable law, legitimate retention obligations and our Privacy Policy.

Termination does not automatically eliminate obligations or rights that by their nature should survive termination.

---

24. LAW ENFORCEMENT AND LEGAL COMPLIANCE

FashFOS may cooperate with competent law-enforcement agencies, courts, regulators and other lawful authorities where required or permitted by applicable law.

Nothing in these Terms prevents FashFOS from complying with a valid legal request, court order, regulatory requirement or law-enforcement request.

25. DISPUTE RESOLUTION

If you have a dispute with FashFOS, you agree, where legally permissible, to first contact us and provide a reasonable opportunity to investigate and resolve the issue.

Where the dispute cannot be resolved informally, the parties may pursue mediation, arbitration or court proceedings as permitted or required by applicable Nigerian law.

Nothing in this section prevents a party from seeking urgent interim or protective relief from a court of competent jurisdiction where necessary.

26. GOVERNING LAW

These Terms shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria, subject to any mandatory legal rights or protections applicable to the User.

The courts or other dispute-resolution bodies having lawful jurisdiction shall have jurisdiction over disputes arising from these Terms, subject to any valid arbitration or mediation agreement applicable to the dispute.

27. THIRD-PARTY BENEFICIARIES

Except where expressly stated otherwise, these Terms do not create rights for persons who are not parties to them.

Third-party service providers may have separate contractual relationships with FashFOS or Users.

28. FORCE MAJEURE

FashFOS shall not be responsible for failure or delay in performing obligations caused by circumstances beyond its reasonable control, including natural disasters, epidemics, war, terrorism, civil unrest, government action, telecommunications failures, internet infrastructure failures, power failures, cyber incidents, third-party outages or other extraordinary circumstances.

This clause does not eliminate any mandatory legal rights or remedies.

29. SEVERABILITY

If any provision of these Terms is found to be unlawful, invalid or unenforceable, that provision shall be interpreted or modified to the minimum extent necessary to make it lawful and enforceable, where legally permissible.

If modification is not possible, the affected provision shall be severed to the extent necessary without invalidating the remaining provisions.

30. NO WAIVER

A failure or delay by FashFOS to enforce any provision of these Terms does not constitute a waiver of that provision or our right to enforce it later.

31. ENTIRE AGREEMENT

These Terms, together with the Privacy Policy and any additional terms expressly incorporated into the Platform, constitute the agreement between you and FashFOS concerning your use of the Platform.

Where a feature has separate terms, those terms will apply to that feature in addition to these Terms.

32. CHANGES TO THESE TERMS

FashFOS may update these Terms from time to time.

Where material changes are made, we may provide notice through the Platform, email or other reasonable means where appropriate or legally required.

Your continued use of the Platform after the effective date of updated Terms constitutes acceptance of the updated Terms to the extent permitted by applicable law.

If you do not agree to the updated Terms, you must stop using the Platform.

33. CONTACT AND COMPLAINTS

Questions, complaints, safety reports and legal notices concerning the Platform may be submitted through the official contact channels made available by FashFOS.

Legal/Support Contact: [INSERT OFFICIAL EMAIL]

Company: FashFOS [INSERT FULL REGISTERED LEGAL NAME]

Registered Address: [INSERT REGISTERED OFFICE]

Website: nearby.fashfos.com

34. USER ACKNOWLEDGEMENT

BY CREATING AN ACCOUNT OR USING NEARBY, YOU ACKNOWLEDGE THAT:

YOU HAVE READ THESE TERMS;

YOU UNDERSTAND THEIR CONTENT;

YOU AGREE TO BE BOUND BY THEM;

YOU UNDERSTAND THAT NEARBY DOES NOT GUARANTEE THE IDENTITY, CHARACTER OR SAFETY OF OTHER USERS;

YOU UNDERSTAND THAT PHYSICAL MEETUPS WITH OTHER USERS INVOLVE INHERENT RISKS;

YOU UNDERSTAND THAT LOCATION INFORMATION MAY NOT ALWAYS BE ACCURATE;

YOU AGREE TO USE YOUR OWN JUDGMENT AND TAKE REASONABLE SAFETY PRECAUTIONS;

YOU ARE RESPONSIBLE FOR YOUR OWN CONDUCT AND CONTENT; AND

YOU UNDERSTAND THAT NOTHING IN THESE TERMS REMOVES RIGHTS OR REMEDIES THAT CANNOT LAWFULLY BE EXCLUDED UNDER APPLICABLE LAW.

BY SELECTING “I AGREE”, CREATING AN ACCOUNT OR CONTINUING TO USE THE PLATFORM, YOU ACCEPT THESE TERMS.

END OF TERMS OF SERVICE`;

/**
 * True when the agreement itself is missing.
 *
 * The sign-up screen refuses to offer "I AGREE" in this state, because the only
 * alternative is recording agreement to an incomplete document for every user
 * who signs up meanwhile.
 */
export const TERMS_ARE_PLACEHOLDER = TERMS_BODY.trim().length < 500;

/** Which of the three fill-in-the-blank placeholders are still present. */
export function unfilledTermsPlaceholders(): string[] {
  return TERMS_PLACEHOLDERS.filter((p) => TERMS_BODY.includes(p));
}

export interface TermsSection {
  /** e.g. "34" — the number as written in the heading. */
  number: string;
  /** Heading text with the number stripped, e.g. "USER ACKNOWLEDGEMENT". */
  title: string;
  /** Everything under the heading, verbatim. */
  body: string;
}

/**
 * Split the agreement into sections.
 *
 * Matches `N. TITLE` where the title is upper-case — the form every heading in
 * this document uses. Deliberately NOT a generic "any numbered line" rule: the
 * prohibited-conduct list in section 4 and the indemnity list in section 22 are
 * both numbered, and would otherwise each be split into twenty-odd phantom
 * sections. Those list items begin lower-case, which is what separates them.
 */
const HEADING = /^(\d{1,2})\.\s+([A-Z][A-Z0-9 ,&\-\/()']*)$/;

export function parseTermsSections(raw: string): TermsSection[] {
  const lines = raw.split('\n');
  const sections: TermsSection[] = [];
  let current: TermsSection | null = null;

  for (const line of lines) {
    const match = HEADING.exec(line.trim());

    if (match) {
      if (current) sections.push(current);
      current = { number: match[1], title: match[2], body: '' };
      continue;
    }

    if (current) {
      current.body += (current.body ? '\n' : '') + line;
    } else if (line.trim() && line.trim() !== '---') {
      // Anything before the first heading (the title block and the opening
      // paragraphs) is kept as section "0" so it is displayed, not dropped.
      if (sections.length === 0) {
        sections.push({ number: '0', title: '', body: '' });
      }
      const preamble = sections[0];
      preamble.body += (preamble.body ? '\n' : '') + line;
    }
  }

  if (current) sections.push(current);

  return sections.map((s) => ({ ...s, body: s.body.trim() })).filter((s) => s.body || s.title);
}
