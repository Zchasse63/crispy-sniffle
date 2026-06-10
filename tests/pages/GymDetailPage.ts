import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the Scout Gym Detail page (/gym/[slug]).
 *
 * All selectors are verified against the live DOM:
 *   specs/features/gym-detail-analysis.md
 *
 * IMPORTANT: several locators intentionally return 0-count results on gyms
 * where that element is absent (e.g. gallery on Amped, parking on Amped).
 * Tests must use .count() / .isVisible() rather than .textContent() on
 * possibly-absent elements to avoid the textContent-on-absent-element trap
 * documented in specs/bugs/discovery-core-bugs.md.
 */
export class GymDetailPage {
  readonly page: Page;
  readonly slug: string;

  constructor(page: Page, slug: string) {
    this.page = page;
    this.slug = slug;
  }

  async goto(): Promise<void> {
    await this.page.goto(`/gym/${this.slug}`);
    // h1 visible = RSC has rendered the gym name
    await this.page.locator("h1").first().waitFor({ state: "visible" });
  }

  // ── Hero ───────────────────────────────────────────────────────────────────

  /** Gym name heading. */
  h1(): Locator {
    return this.page.locator("h1").first();
  }

  /**
   * Segment chip: `<p class="readout text-pool">` in the hero dark section.
   * Scoped to the hero section to avoid false matches in similar-spots cards.
   */
  segmentChip(): Locator {
    return this.page
      .locator("section.survey-grid-night")
      .locator("p.readout.text-pool")
      .first();
  }

  /** Neighborhood + address line rendered below h1 in the hero. */
  neighborhoodLine(): Locator {
    return this.page
      .locator("section.survey-grid-night")
      .locator("p.readout.mt-3")
      .first();
  }

  /**
   * Day-pass price chip — only present when gym.day_pass_price !== null.
   * Text shape: "Day pass $20".
   */
  dayPassChip(): Locator {
    return this.page
      .locator("span")
      .filter({ hasText: /^Day pass \$\d+$/ })
      .first();
  }

  /**
   * Open 24h hero chip (green background) — only on 24h gyms.
   * Distinct from the Hours "Open 24 hours, every day" text.
   */
  open24hChip(): Locator {
    return this.page
      .locator("section.survey-grid-night span")
      .filter({ hasText: /^Open 24h$/i })
      .first();
  }

  /** "Directions" link — href matches Google Maps directions URL. */
  directionsLink(): Locator {
    return this.page.locator('a[href*="google.com/maps"]').first();
  }

  /** "Call" link — href is tel: — absent when gym has no phone. */
  callLink(): Locator {
    return this.page.locator('a[href^="tel:"]').first();
  }

  /** "Website" link — target=_blank, href starts with http. */
  websiteLink(): Locator {
    return this.page.locator('a:has-text("Website")').first();
  }

  /** "Back to Explore" breadcrumb link. */
  backLink(): Locator {
    return this.page.locator('a:has-text("Back to Explore")').first();
  }

  // ── Train Here ────────────────────────────────────────────────────────────

  trainHereButton(): Locator {
    return this.page.locator('button:has-text("I trained here")').first();
  }

  /** SignInModal dialog — appears after unauthenticated TrainHere click. */
  signInModal(): Locator {
    return this.page.locator('[role="dialog"][aria-label="Sign in to Scout"]');
  }

  /** Email input inside SignInModal. */
  emailInput(): Locator {
    return this.page.locator('input[type="email"]').first();
  }

  // ── Gallery ───────────────────────────────────────────────────────────────

  /**
   * Gallery scroll container — only rendered when photos.length > 1.
   * Absent on Amped (1 photo).
   */
  galleryContainer(): Locator {
    return this.page.locator("div.flex.gap-2.overflow-x-auto").first();
  }

  /** Images inside the gallery scroll container. */
  galleryImages(): Locator {
    return this.page.locator("div.flex.gap-2.overflow-x-auto img");
  }

  // ── Attribute Sections ────────────────────────────────────────────────────

  /** Equipment section heading — absent on Kodawari. */
  equipmentHeading(): Locator {
    return this.page.locator("h2.readout").filter({ hasText: "Equipment" }).first();
  }

  /** "Pro preview" chip inside Equipment heading — absent on Kodawari. */
  proPreviewChip(): Locator {
    return this.page.locator('span:has-text("Pro preview")').first();
  }

  /**
   * All fact rows across every AttributeSection.
   * CSS class: `group/fact flex items-center justify-between gap-3 py-2.5`
   * Tailwind group utility requires escaping the slash.
   */
  factRows(): Locator {
    return this.page.locator("li.group\\/fact");
  }

  /**
   * Provenance badge spans with a specific label text.
   * Each badge is: `<span class="readout inline-flex ... border-paper-line">label</span>`
   */
  provenanceBadge(label: string): Locator {
    return this.page
      .locator("span.readout.inline-flex")
      .filter({ hasText: label });
  }

  // ── Hours ─────────────────────────────────────────────────────────────────

  /**
   * Open/Closed now status chip in the Hours card.
   * Text: "Open now" (pool-tint background) or "Closed now" (paper background).
   */
  openStatusChip(): Locator {
    return this.page
      .locator("span")
      .filter({ hasText: /^(Open|Closed) now$/ })
      .first();
  }

  /** "Open 24 hours, every day" text — only on Amped. */
  hours24hText(): Locator {
    return this.page.locator('text="Open 24 hours, every day"');
  }

  /** Entire Hours section (`<section>` containing the Hours h2). */
  hoursSection(): Locator {
    return this.page.locator("section").filter({ has: this.page.locator("h2").filter({ hasText: "Hours" }) }).first();
  }

  // ── Getting In ────────────────────────────────────────────────────────────

  /** Entire "Getting in" section. Absent when no policy/price. */
  gettingInSection(): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.locator("h2").filter({ hasText: "Getting in" }) })
      .first();
  }

  /**
   * Drop-in policy chip by its label text.
   * Labels: "Walk in", "Book first", "Restricted drop-in", "Free trial route", "Members only"
   */
  dropInPolicyChip(text: string): Locator {
    return this.gettingInSection()
      .locator("span.font-mono")
      .filter({ hasText: text })
      .first();
  }

  /**
   * Break-even line — only rendered when both monthly_from and day_pass_price
   * are present and breakEven > 1 (Powerhouse only in our test set).
   */
  breakEvenLine(): Locator {
    return this.page.locator("p").filter({ hasText: /visit.*each month/ }).first();
  }

  // ── Parking & Transit ─────────────────────────────────────────────────────

  /** Entire "Parking & getting there" section — absent on Amped. */
  parkingSection(): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.locator("h2").filter({ hasText: "Parking" }) })
      .first();
  }

  /** Primary parking recommendation paragraph (bold text). */
  parkingPrimaryRec(): Locator {
    return this.parkingSection()
      .locator("p.flex.items-start.gap-2.font-semibold")
      .first();
  }

  /** Alternatives list `<ul>` inside parking section. */
  parkingAlternativesList(): Locator {
    return this.parkingSection().locator("ul.mt-3.divide-y").first();
  }

  /** OSM attribution line in the parking card. */
  osmAttribution(): Locator {
    return this.page.locator(
      'text="Parking & transit data © OpenStreetMap contributors"',
    );
  }

  // ── Community ─────────────────────────────────────────────────────────────

  /** Entire "From the community" section. */
  communitySection(): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.locator("h2").filter({ hasText: "From the community" }) })
      .first();
  }

  /**
   * The main content grid wrapper — used to verify CommunitySection is in
   * the left column (first child) and not in the aside (right column).
   */
  contentGrid(): Locator {
    return this.page.locator("div.grid.grid-cols-1.gap-6").first();
  }

  /** The left column div inside the content grid. */
  leftColumn(): Locator {
    return this.contentGrid().locator("> div").first();
  }

  /** "Sign in to review {gymName}" button — visible signed-out. */
  reviewSignInButton(): Locator {
    return this.page.locator('button:has-text("Sign in to review")').first();
  }

  /** Outbound discussion links (reddit, etc.) in the community section. */
  discussionLinks(): Locator {
    return this.communitySection().locator('a[target="_blank"]');
  }

  /**
   * "Verify your info" / "Own this gym?" CTA mailto link.
   * href: mailto:...?subject=Verify%20our%20listing%3A%20{gymName}
   */
  verifyOwnLink(): Locator {
    return this.page.locator('a:has-text("Verify your info")').first();
  }

  // ── SEO ───────────────────────────────────────────────────────────────────

  /** JSON-LD structured data script tag. */
  jsonLdScript(): Locator {
    return this.page.locator('script[type="application/ld+json"]').first();
  }

  // ── Similar Spots ─────────────────────────────────────────────────────────

  /** "Similar … spots" section at page bottom. */
  similarSection(): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.locator("h2").filter({ hasText: /Similar/ }) })
      .first();
  }

  /** All /gym/ links on the page (includes similar-spots cards and nav). */
  similarGymLinks(): Locator {
    return this.page.locator('a[href^="/gym/"]');
  }
}
