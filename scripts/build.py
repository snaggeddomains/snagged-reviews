#!/usr/bin/env python3
"""Generate index.html for SnaggedReviews.com from the testimonial dataset.

Run:  python3 scripts/build.py
Output: index.html (fully static, no runtime dependencies).
"""
import html
import re
import json
from pathlib import Path

SITE_URL = "https://snaggedreviews.com/"
# Outbound CTA link to Snagged, with UTM tracking (HTML-attribute safe: &amp;).
SNAGGED_URL = "https://www.snagged.com/?utm_source=snagged_review&amp;utm_medium=link_click"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "reviews.json"

# --- SVG snippets -----------------------------------------------------------
STAR = ('<svg viewBox="0 0 24 24" fill="#f5a623" aria-hidden="true">'
        '<path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.9 6.1 21l1.1-6.45-4.7-4.6 6.5-.95z"/></svg>')
VBADGE = ('<svg class="vbadge" viewBox="0 0 24 24" aria-label="Verified account" role="img">'
          '<path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/>'
          '<path fill="#fff" d="M9.8 16.3l-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"/></svg>')
X_LOGO = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
          '<path d="M18.9 1.6h3.5l-7.6 8.7 9 11.9h-7l-5.5-7.2-6.3 7.2H1.5l8.1-9.3L1 1.6h7.2l5 6.6zM17.7 20h1.9L7.1 3.6H5z"/></svg>')
ENVELOPE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
            '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>')
CHAT = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
        '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>')
QUOTE = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
         '<path d="M7.5 6C5 6 3 8 3 10.6 3 13 4.8 15 7.2 15c.2 0 .5 0 .7-.1-.5 1.6-1.9 2.8-3.6 3.2l.6 1.9c3.4-.8 6-3.8 6-7.6V10.6C10.9 8 8.9 6 7.5 6zm9.3 0c-2.5 0-4.5 2-4.5 4.6 0 2.4 1.8 4.4 4.2 4.4.2 0 .5 0 .7-.1-.5 1.6-1.9 2.8-3.6 3.2l.6 1.9c3.4-.8 6-3.8 6-7.6V10.6C20.2 8 18.2 6 16.8 6z"/></svg>')
EYE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
       '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>')
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
         '<path d="M7 17L17 7M9 7h8v8"/></svg>')
SRC_ICON = {"x": X_LOGO, "email": ENVELOPE, "text": CHAT, "direct": QUOTE}
SRC_LABEL = {"x": "X (Twitter)", "email": "Email", "text": "Text message", "direct": "Direct testimonial"}

# --- Testimonial dataset ----------------------------------------------------
# Reviews live in data/reviews.json (edited via /admin or by hand). Each entry:
#   name (required), text (required), source: x | email | text | direct,
#   handle, role, verified, featured, anon, date, iso, url, domain, shot.
T = json.loads(DATA.read_text(encoding="utf-8"))

# --- helpers ----------------------------------------------------------------
DOMAIN_RE = re.compile(r'\b([A-Za-z0-9][A-Za-z0-9-]*\.(?:com|ai|net|st|gg|so|io))\b(/[^\s<]*)?', re.I)
MENTION_RE = re.compile(r'@([A-Za-z0-9_]+)')

def initials(name):
    parts = [p for p in re.split(r'[\s—·]+', name) if p and p[0].isalnum()]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0][0].upper()
    return (parts[0][0] + parts[1][0]).upper()

def avatar_colors(name):
    h = 0
    for ch in name:
        h = (h * 31 + ord(ch)) & 0xffffffff
    hue = h % 360
    return f"hsl({hue} 62% 54%)", f"hsl({(hue + 28) % 360} 66% 44%)"

def inline(t):
    t = html.escape(t, quote=False)
    t = MENTION_RE.sub(r'<span class="mention">@\1</span>', t)
    t = DOMAIN_RE.sub(lambda m: '<span class="domain">' + m.group(0) + '</span>', t)
    return t

def render_text(text):
    paras = re.split(r'\n\s*\n', text.strip())
    out = []
    for p in paras:
        out.append('<p>' + inline(p).replace('\n', '<br>') + '</p>')
    return '\n          '.join(out)

def card_html(t):
    src = t["source"]
    a, b = avatar_colors(t["name"])
    if t.get("anon"):
        avatar = f'<div class="avatar" style="--a:{a};--b:{b}">{QUOTE}</div>'
    else:
        avatar = f'<div class="avatar" style="--a:{a};--b:{b}">{initials(t["name"])}</div>'

    meta_bits = []
    if t.get("handle"):
        meta_bits.append(f'<span class="handle">@{html.escape(t["handle"])}</span>')
    if t.get("role"):
        meta_bits.append(f'<span class="role">{html.escape(t["role"])}</span>')
    meta = ' · '.join(meta_bits)
    name_html = html.escape(t["name"]) + (VBADGE if t.get("verified") else "")

    actions = []
    if t.get("url"):
        actions.append(f'<a class="linkbtn" href="{t["url"]}" target="_blank" rel="noopener">{X_LOGO}View on X</a>')
    # Only offer the screenshot when there's no X link — the live post is better proof, so don't show both.
    if t.get("shot") and not t.get("url"):
        actions.append(f'<button type="button" class="linkbtn" data-shot="assets/screenshots/{t["shot"]}" '
                       f'data-name="{html.escape(t["name"])}">{EYE}View screenshot</button>')
    actions_html = ('<div class="card__actions">' + ''.join(actions) + '</div>') if actions else '<span></span>'

    date_html = f'<span class="card__date">{html.escape(t["date"])}</span>' if t.get("date") else '<span class="card__date"></span>'
    domain_tag = f'\n          <span class="tag-domain">{ARROW}Acquired {html.escape(t["domain"])}</span>' if t.get("domain") else ''

    return f'''        <article class="card" data-source="{src}" data-featured="{str(t.get("featured", False)).lower()}">
          <div class="card__head">
            {avatar}
            <div class="card__id">
              <div class="card__name">{name_html}</div>
              <div class="card__meta">{meta}</div>
            </div>
            <div class="src src--{src}" title="{SRC_LABEL[src]}" aria-label="{SRC_LABEL[src]}">{SRC_ICON[src]}</div>
          </div>
          <div class="card__body">
          {render_text(t["text"])}
          </div>{domain_tag}
          <div class="card__foot">
            {date_html}
            {actions_html}
          </div>
        </article>'''

# --- counts -----------------------------------------------------------------
total = len(T)
counts = {"all": total, "x": 0, "email": 0, "text": 0, "direct": 0}
for t in T:
    counts[t["source"]] += 1

# --- title / meta description (defined early; used in head + structured data) -
title = "Snagged Reviews — What Founders Say About the Snagged.com Domain Broker"
desc = ("Snagged reviews: verified testimonials from founders and operators who used Snagged.com to "
        "acquire premium domains. See what Alexis Ohanian, Garry Tan, Nathan Barry, Theo and more say "
        "about Rob, Brian and the Snagged domain broker team — rated 5.0/5.")

# --- JSON-LD structured data ------------------------------------------------
reviews_ld = []
for t in T:
    r = {
        "@type": "Review",
        "author": {"@type": "Person" if not t.get("anon") else "Person", "name": t["name"]},
        "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5", "worstRating": "1"},
        "reviewBody": re.sub(r'\s+', ' ', t["text"]).strip(),
    }
    if t.get("iso"):
        r["datePublished"] = t["iso"]
    if t.get("url"):
        r["url"] = t["url"]
    reviews_ld.append(r)

org_ld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Snagged",
    "alternateName": ["Snagged.com", "Snagged Domains"],
    "url": "https://snagged.com",
    "description": "Snagged is a premium domain name brokerage and acquisition service founded by Rob Schutz that helps founders and companies track down, negotiate and acquire hard-to-get domain names.",
    "founder": {"@type": "Person", "name": "Rob Schutz"},
    "employee": [
        {"@type": "Person", "name": "Rob Schutz", "jobTitle": "Founder", "sameAs": "https://x.com/rob"},
        {"@type": "Person", "name": "Brian Jarcho", "jobTitle": "Partner"},
    ],
    "sameAs": ["https://x.com/snagged", "https://x.com/rob"],
    "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5.0",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": str(total),
        "reviewCount": str(total),
    },
    "review": reviews_ld,
}

faqs = [
    ("Is Snagged legit?",
     "Yes. Snagged (snagged.com) is a real domain name brokerage founded by Rob Schutz, co-founder of the healthcare company Ro, and run alongside partner Brian Jarcho, who spent seven years on Zocdoc's leadership team and over twenty years in enterprise sales. Well-known founders and operators — including Alexis Ohanian (Reddit), Garry Tan (Y Combinator), Nathan Barry (Kit), Esther Crawford and Theo (t3.gg) — have publicly thanked Snagged for acquiring premium domains on their behalf. Every Snagged review on this page comes from a real, named client or a public post on X."),
    ("What is Snagged.com?",
     "Snagged is a premium domain brokerage and acquisition service. The team finds hard-to-get domain names, reaches out to and negotiates with the current owner on your behalf, and manages the escrow and transfer process from start to finish — so you don't have to deal with the domain world yourself."),
    ("What do people say in Snagged reviews?",
     "Reviews of Snagged are overwhelmingly positive. Across the testimonials collected here the average rating is 5.0 out of 5. Clients consistently highlight the speed (\"fastest response time I've ever seen\"), how painless the process is (\"they made it 100% painless\"), and the strong negotiation (one founder reported getting \"$20K off\" a domain)."),
    ("Who is Rob from Snagged?",
     "Rob Schutz is the founder of Snagged and the co-founder of Ro (and previously the first marketing hire at Bark). On X he goes by @rob. Founders routinely describe him as their go-to broker for hard-to-get domains and praise his transparency, responsiveness and negotiating skills."),
    ("What domains has Snagged helped acquire?",
     "Clients have publicly credited Snagged with deals including Ohanian.com (Alexis Ohanian), Kit.com (Nathan Barry), \"Huge If True\" .com (Cleo Abram), Mainstreet.AI (Jesse Tinsley), dreambase.com (Kyle Ledbetter), zodl.com (mert) and gli.st (Garry Tan), among many others."),
    ("How much does Snagged cost?",
     "Pricing depends on the specific domain and the scope of the acquisition. Clients note that Snagged negotiates strong deals — one founder reported saving $20K in a single negotiation. For a quote on a specific domain, reach out through snagged.com."),
    ("How do I work with Snagged?",
     "Head to snagged.com and tell the team which domain or social handle you're after. They'll scope the acquisition, handle outreach and negotiation with the current owner, and manage escrow and the transfer end to end."),
    ("Are the Snagged reviews on this page real?",
     "Yes. Every review is attributed to a named person, and where it began as a public post it links straight to the original on X so you can verify it yourself. The rest are emails and text messages clients sent the Snagged team. Nothing on this page is anonymous or invented."),
    ("Is Snagged worth it?",
     "For founders chasing a specific, hard-to-get domain, the reviews of Snagged are consistent: it saves months of back-and-forth, takes the stress out of negotiating with owners, and often lands a better price than going direct — one founder reported saving $20K. If the exact .com or .ai you want is already taken, that is precisely what Snagged is for."),
    ("Where can I find more reviews of Snagged?",
     "Beyond this page, the most candid Snagged.com reviews live on X, where founders such as Alexis Ohanian, Garry Tan, Nathan Barry, Cleo Abram and Theo have posted about their domain acquisitions unprompted. Every review collected here links back to its original post."),
]
faq_ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": q,
         "acceptedAnswer": {"@type": "Answer", "text": a}}
        for q, a in faqs
    ],
}
webpage_ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Snagged Reviews",
    "url": SITE_URL,
    "inLanguage": "en",
    "description": desc,
    "dateModified": "2026-05-22",
    "primaryImageOfPage": SITE_URL + "assets/img/og-image.png",
    "about": {"@type": "Organization", "name": "Snagged", "url": "https://snagged.com"},
    "isPartOf": {"@type": "WebSite", "name": "Snagged Reviews", "url": SITE_URL},
    "significantLink": "https://www.snagged.com/",
}

def ld(obj):
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2) + '\n</script>'

# --- assemble sections ------------------------------------------------------
cards = '\n'.join(card_html(t) for t in T)

faq_html = '\n'.join(
    f'''        <details{" open" if i == 0 else ""}>
          <summary>{html.escape(q)}</summary>
          <div><p>{inline(a)}</p></div>
        </details>''' for i, (q, a) in enumerate(faqs)
)

LOGOS = ["Reddit", "Y Combinator", "Kit", "Nourish", "Slash", "Monarch", "Graphite", "Scribe", "Delete", "Seneca", "Lovable"]
logos_html = '\n'.join(f'        <span>{l}</span>' for l in LOGOS)

def wave(flip=False):
    cls = "wave wave--flip" if flip else "wave"
    return (f'<svg class="{cls}" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">'
            '<path fill="#f4eee1" d="M0,0 H1440 V30 C1240,66 1110,10 870,34 C660,55 500,4 270,30 '
            'C175,41 75,39 0,27 Z"/></svg>')

# --- page -------------------------------------------------------------------
PAGE = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <link rel="canonical" href="{SITE_URL}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="theme-color" content="#cfeaef">
  <meta name="author" content="Snagged">
  <meta name="keywords" content="Snagged reviews, Snagged.com reviews, Snagged domain broker reviews, is Snagged legit, Snagged testimonials, Rob Schutz domains, domain broker reviews">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Snagged Reviews">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:url" content="{SITE_URL}">
  <meta property="og:image" content="{SITE_URL}assets/img/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{html.escape(title)}">
  <meta name="twitter:description" content="{html.escape(desc)}">
  <meta name="twitter:image" content="{SITE_URL}assets/img/og-image.png">

  <link rel="icon" href="assets/brand/logomark-round.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/brand/webclip.png">
  <link rel="icon" href="assets/brand/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="preconnect" href="{SNAGGED_URL}">
  <link rel="preload" as="font" type="font/woff2" href="assets/fonts/gasoekone.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="assets/fonts/bricolagegrotesque.woff2" crossorigin>
  <link rel="stylesheet" href="assets/css/styles.css">

  {ld(org_ld)}
  {ld(faq_ld)}
  {ld(webpage_ld)}
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="/" aria-label="Snagged Reviews home">
        Snagged<span class="brand__sub">&nbsp;Reviews</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a class="nav__link" href="#reviews">Reviews</a>
        <a class="nav__link" href="#faq">FAQ</a>
        <a class="nav__link" href="#about">About Snagged</a>
        <a class="btn btn--navy" href="{SNAGGED_URL}" target="_blank" rel="noopener">Visit Snagged.com</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="wrap hero__grid">
        <div class="hero__copy">
          <span class="eyebrow">{STAR} Verified Snagged reviews &amp; testimonials</span>
          <h1>Snagged <span class="grad">Reviews</span></h1>
          <p class="hero__lede">What founders and operators really say about <strong>Snagged.com</strong> — the
            domain broker that tracks down hard-to-get domain names and gets the deal done. Real reviews from
            real clients, pulled from public posts on X plus emails and texts.</p>

          <div class="hero__cta">
            <a class="btn btn--primary btn--lg" href="#reviews">Read the reviews</a>
            <a class="btn btn--ghost btn--lg" href="{SNAGGED_URL}" target="_blank" rel="noopener">Work with Snagged {ARROW}</a>
          </div>

          <div class="rating" role="img" aria-label="Rated 5.0 out of 5 by founders and operators">
            <span class="stars">{STAR}{STAR}{STAR}{STAR}{STAR}</span>
            <span class="rating__line"><strong>5.0 / 5.0</strong> from verified founder &amp; operator reviews</span>
          </div>
        </div>

        <div class="hero__mascot">
          <img src="assets/brand/mascot-hero.png" width="820" height="940" fetchpriority="high"
               alt="The Snagged fisherman mascot reeling in a freshly caught domain name">
          <img class="hero__sticker" src="assets/brand/sticker-fresh.png" width="420" height="415" alt="" loading="lazy">
        </div>
      </div>

      <div class="wrap">
        <div class="trust">
          <p class="trust__label">Trusted by founders &amp; operators behind</p>
          <div class="logos">
{logos_html}
          </div>
        </div>
      </div>
    </section>

    <section class="reviews" id="reviews">
      {wave()}
      <div class="reviews__body">
        <div class="section__head">
          <h2>Snagged reviews from founders &amp; operators</h2>
          <p>Looking for reviews of Snagged? Every Snagged.com review below is from a real, named client —
            pulled from public posts on X, plus emails and text messages — so you can judge the Snagged domain
            broker for yourself. Tap “View on X” to open the original post.</p>
        </div>

        <div class="filters" role="group" aria-label="Filter reviews by source">
          <button class="chip" data-filter="all" aria-pressed="true">All <span class="chip__n">{counts['all']}</span></button>
          <button class="chip" data-filter="x" aria-pressed="false">X / Twitter <span class="chip__n">{counts['x']}</span></button>
          <button class="chip" data-filter="email" aria-pressed="false">Email <span class="chip__n">{counts['email']}</span></button>
          <button class="chip" data-filter="text" aria-pressed="false">Text <span class="chip__n">{counts['text']}</span></button>
          <button class="chip" data-filter="direct" aria-pressed="false">Direct <span class="chip__n">{counts['direct']}</span></button>
        </div>

        <div class="wall">
{cards}
        </div>

        <p class="reviews__note">Across every Snagged review here the verdict is the same: founders call the
          process fast, painless and genuinely worth it — and keep coming back for their next domain.</p>
      </div>
      {wave(flip=True)}
    </section>

    <section class="section section--cream" id="about">
      <div class="wrap">
        <div class="section__head">
          <h2>About Snagged</h2>
          <p>Snagged (<a href="{SNAGGED_URL}" target="_blank" rel="noopener">snagged.com</a>) is a premium
            domain brokerage founded by Rob Schutz, co-founder of Ro. Rob and Brian Jarcho track down
            hard-to-get domains, negotiate with current owners, and handle escrow and transfer end to end —
            the work behind every five-star Snagged review on this page.</p>
        </div>

        <div class="faq" id="faq">
{faq_html}
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="wrap">
        <div class="cta">
          <div>
            <h2>Want results like these?</h2>
            <p>Join the founders who let Snagged track down and negotiate their perfect domain — painlessly.
              Tell the team which name you're after and they'll handle the rest.</p>
            <a class="btn btn--primary btn--lg" href="{SNAGGED_URL}" target="_blank" rel="noopener">Get started at Snagged.com {ARROW}</a>
          </div>
          <div class="cta__art">
            <img src="assets/brand/mascot-closing.png" width="640" height="682" loading="lazy"
                 alt="The Snagged mascot celebrating a closed domain deal">
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div class="cols">
        <div>
          <img class="site-footer__word" src="assets/brand/wordmark-white.png" width="666" height="104"
               alt="Snagged" loading="lazy">
          <p>The home for verified reviews and testimonials about Snagged.com — the domain broker founders
            recommend for hard-to-get domains.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#reviews">Reviews</a>
          <a href="#faq">FAQ</a>
          <a href="#about">About Snagged</a>
          <a href="{SNAGGED_URL}" target="_blank" rel="noopener">Snagged.com {ARROW}</a>
        </nav>
      </div>
      <p class="disclaimer">Reviews on SnaggedReviews.com are sourced from public posts on X and from direct
        client communications. Screenshots of private emails and text messages are shown as typeset quotes to
        protect personal contact information. “Snagged” and “Snagged.com” refer to the domain brokerage at
        snagged.com. © 2026 Snagged. All rights reserved.</p>
    </div>
  </footer>

  <div class="lb" id="lightbox" role="dialog" aria-modal="true" aria-label="Original review screenshot">
    <div class="lb__inner">
      <div class="lb__bar">
        <span class="lb__cap"></span>
        <button type="button" class="lb__close" aria-label="Close">&times;</button>
      </div>
      <div class="lb__img"><img src="" alt=""></div>
    </div>
  </div>

  <script src="assets/js/main.js" defer></script>
</body>
</html>
'''

(ROOT / "index.html").write_text(PAGE, encoding="utf-8")
print(f"Wrote index.html — {total} reviews "
      f"(x={counts['x']}, email={counts['email']}, text={counts['text']}, direct={counts['direct']})")
