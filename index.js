#!/usr/bin/env node
/**
 * Monetize MCP — free, local monetization toolkit for digital products.
 *
 * Tools:
 *  - brainstorm_monetization_models -> ranked ways to monetize an asset
 *  - pricing_strategy               -> recommended price + tier structure
 *  - revenue_projection             -> scenario table: price x units x fees
 *  - listing_copy                   -> product listing copy (name, tagline, SEO)
 *  - pricing_page                   -> ready-to-publish markdown pricing page
 *  - launch_plan                    -> week-by-week go-to-market checklist
 *  - free_platforms_playbook        -> where to sell/distribute for $0
 *  - maintenance_loop               -> recurring/passive income cadence
 *
 * Deterministic and offline: numbers are scenario math, platform facts are a
 * curated snapshot — verify fee percentages on the platform page before launch.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "monetize-mcp", version: "1.0.0" });

function json(v) {
  return { content: [{ type: "text", text: JSON.stringify(v, null, 2) }] };
}
const $ = (n) => "$" + n.toFixed(n % 1 ? 2 : 0);

/* ------------------------------------------------------------------ */
/* Tool: brainstorm_monetization_models                                */
/* ------------------------------------------------------------------ */
server.tool(
  "brainstorm_monetization_models",
  "Given an asset you created (MCP server, skill pack, template, guide) and your audience, return ranked monetization models with effort level, price range and fit reasoning.",
  {
    asset: z.string().describe("What you built, e.g. 'MCP server with 12 strategy tools'"),
    audience: z.string().describe("Who wants it, e.g. 'indie hackers using OpenCode'"),
    extraSkills: z.string().optional().describe("Comma-separated extras: 'content creation, youtube, design'"),
  },
  async ({ asset, audience, extraSkills }) => {
    const models = [
      { model: "One-time sale", fit: 5, effort: "Low", range: "$9–$49", why: `Fastest first dollar. Works when the asset is complete and the audience is findable (${audience}). Downside: no repeat revenue.` },
      { model: "Tiered (Good/Better/Best)", fit: 5, effort: "Low", why: "A $9 basics / $19 full / $39 full+updates ladder captures the price-sensitive AND the serious buyer. Most digital-product sellers see 50-70% of revenue from the top tier." },
      { model: "Subscription (monthly)", fit: 4, effort: "Medium", why: "Best for ongoing value: the asset gets updated, or you add members-only tools/templates. $5–$15/mo. Compounds into recurring income on the passive path." },
      { model: "Open-core + paid Pro", fit: 4, effort: "Medium", why: "Free core on GitHub (SEO + trust + users find you), paid Pro pack ($19–$49) with extra tools. This is the classic for software/tool assets like MCPs." },
      { model: "Bundle", fit: 4, effort: "Low", why: "Package several assets (e.g. strategy + factcheck + leadgen MCPs) at 2–3x a single price. Raises average order value with zero new build work." },
      { model: "License (commercial)", fit: 3, effort: "Low", why: "Free for personal use, paid license for companies to use inside their business ($49–$199). Ships via license key or extra 'pro' copy." },
      { model: "Course / guided setup", fit: 3, effort: "High", why: "People will pay $29–$99 for 'I installed everything and here's the playbook' — your setup + skill files + a video walkthrough. Higher effort, higher ceiling." },
      { model: "Affiliate / sponsorship", fit: 2, effort: "Medium", why: "Once it has users: recommend complementary tools (hosting, templates) for commissions, or sponsorships on your content. Passive once built." },
    ];
    const ranked = models.sort((a, b) => b.fit - a.fit).map((m, i) => ({ rank: i + 1, ...m }));
    return json({
      asset, audience,
      topPick: ranked[0].model,
      note: "Quick win: one-time sale or tiered pack first (days, not weeks). Add subscription/bundle once you have buyers.",
      models: ranked,
    });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: pricing_strategy                                              */
/* ------------------------------------------------------------------ */
server.tool(
  "pricing_strategy",
  "Get a recommended price and tier structure for a digital product, with anchoring and adjustment rules.",
  {
    product: z.string().describe("Product name/type, e.g. 'LeadGen MCP pack'"),
    effortHours: z.number().min(1).optional().describe("Hours to build + maintain (used for the sanity check)"),
    competitorPrices: z.string().optional().describe("Comma-separated observed prices, e.g. '19, 29, 45'"),
    recurring: z.boolean().optional().describe("Is there ongoing value justifying a subscription? (default false)"),
    audienceSize: z.enum(["tiny (<100)", "small (100-1k)", "medium (1k-10k)", "large (10k+)"]).optional().describe("Reachable audience size"),
  },
  async ({ product, effortHours, competitorPrices, recurring = false, audienceSize = "small (100-1k)" }) => {
    const comps = (competitorPrices || "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    const compMid = comps.length ? comps.reduce((a, b) => a + b, 0) / comps.length : null;
    const anchor = compMid ? Math.round(compMid * 1.1) : 29;
    const base = Math.max(9, Math.round(anchor / 1.6));
    const pro = Math.round(anchor * 1.25);
    const lifetime = Math.round(anchor * 1.6);

    const tiers = [
      { tier: "Good", price: base, includes: "Core tool, install guide, 1 minor update", target: "Price-sensitive / students" },
      { tier: "Better" + (recurring ? "" : " (recommended)"), price: pro, includes: "Full tool, playbook, all updates" + (recurring ? " / monthly" : ""), target: "Most buyers" },
      { tier: "Best", price: lifetime, includes: "Everything + source access + priority support", target: "Pro users / agencies" },
    ];
    const sanity = effortHours ? `Sanity check: at ${$(pro)}/sale, ${Math.ceil(effortHours * 20 / pro)} sales pays for ${effortHours}h at a $20/h rate; at ${$((pro * 0.9).toFixed(0))} net that's ~${Math.ceil(effortHours * 20 / (pro * 0.9))} sales to break even on time.` : null;

    return json({
      product,
      observedCompetitors: comps.length ? comps : "none given — anchored to a $29 default",
      recommendation: recurring
        ? `Subscription-first: $${Math.max(5, Math.round(base / 2))}/mo core, $${Math.round(pro / 2)}/mo pro, or $${lifetime} lifetime unlock.`
        : `One-time tiers: $${base} / $${pro} / $${lifetime}. Launch the middle tier as your default-download button.`,
      tiers,
      rules: [
        "Anchor with the middle tier selected; odd prices ($19 vs $20) nudge conversions.",
        "Raise the top tier until ~20% of buyers complain, then keep — that's the ceiling indicator.",
        "Never discount the middle tier — discount the top tier (makes Pro feel like a steal).",
        "Add a 30-day 'not for you, full refund' guarantee: refunds on cheap digital goods are rare and it lifts conversion.",
      ],
      sanity,
      audienceNote: `Audience ${audienceSize}: at ~2% conversion your realistic first-month sales are small — price for VALUE (solve a painful problem) or stay at $9–$19 to build social proof fast.`,
    });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: revenue_projection                                            */
/* ------------------------------------------------------------------ */
server.tool(
  "revenue_projection",
  "Model revenue: pick a price and fee %, see net totals at 10/50/100/500/1000 units, plus what monthly sales counts mean for passive income.",
  {
    price: z.number().positive().describe("Your price, e.g. 29"),
    feePct: z.number().min(0).max(50).optional().describe("Platform fee % (Gumroad free plan ~10%, Lemon Squeezy ~5%, Etsy ~6.5%+listing fees)"),
    unitsPerMonthDream: z.number().optional().describe("Your stretch monthly sales count, e.g. 30"),
  },
  async ({ price, feePct = 10, unitsPerMonthDream }) => {
    const net = price * (1 - feePct / 100);
    const counts = [10, 50, 100, 500, 1000];
    const table = counts.map((u) => ({ unitsSold: u, gross: $(price * u), net: $(net * u) }));
    const monthly = unitsPerMonthDream
      ? { unitsPerMonth: unitsPerMonthDream, grossPerMonth: $(price * unitsPerMonthDream), netPerMonth: $(net * unitsPerMonthDream), yearlyNet: $(net * unitsPerMonthDream * 12) }
      : null;
    return json({
      price, feePct, netPerUnit: $(net),
      table,
      monthly,
      note: monthly ? `At ${unitsPerMonthDream}/mo you'd replace a ${$(unitsPerMonthDream * net * 12 / 52)}/week part-time gig. Keep the loop running monthly and it compounds: past buyers + updates bring repeat sales.` : `Use unitsPerMonthDream to see your monthly-recurring scenario.`,
    });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: listing_copy                                                  */
/* ------------------------------------------------------------------ */
server.tool(
  "listing_copy",
  "Generate product listing copy: name options, tagline, description, feature bullets, SEO title/description and CTA.",
  {
    product: z.string().describe("What it is, e.g. 'StrategyBrain MCP — 12 strategy tools for OpenCode'"),
    audience: z.string().describe("Who it's for"),
    features: z.string().describe("Comma-separated features/benefits, e.g. '12 frameworks, works offline, no API keys'"),
    tone: z.enum(["professional", "friendly", "bold"]).optional().describe("Tone (default professional)"),
    platform: z.enum(["gumroad", "etsy", "general"]).optional().describe("Platform flavor (default general)"),
  },
  async ({ product, audience, features, tone = "professional", platform = "general" }) => {
    const feats = features.split(",").map((f) => f.trim()).filter(Boolean);
    const short = product.length > 42 ? product.slice(0, 39) + "…" : product;
    const names = [
      product,
      `${short.split("—")[0].trim()} Pro Pack`,
      `${short.split("—")[0].trim()} Toolkit (instant download)`,
    ];
    const taglines = [
      `Built for ${audience}. Ready in minutes.`,
      `The ${tone === "bold" ? "no-hype" : "practical"} toolkit ${audience} actually use.`,
      `Stop rebuilding — this does the work ${tone === "professional" ? "out of the box" : "for you"}.`,
    ];
    const desc = [
      `This is the exact tool I built and use for my own work, packaged so you can skip the setup week. If you're ${audience}, everything below is designed to get you from download to result without a manual.`,
      `Inside you get: ${feats.slice(0, 4).join("; ")}. No subscriptions required up front, no API keys to juggle, and it works fully offline.`,
      platform === "gumroad" ? `Instant download after purchase — you'll have a welcome email with your files and a 30-day 'not for you' guarantee.` : `Instant download after purchase.`,
    ];
    const seoTitle = (product + " | " + taglines[0]).slice(0, 60);
    const seoDesc = (`Instant-download ${short.toLowerCase()} for ${audience}: ` + feats.slice(0, 3).join(", ") + ".").slice(0, 158);
    return json({
      nameOptions: names,
      taglineOptions: taglines,
      description: desc.join(" "),
      highlights: feats.slice(0, 6).map((f) => `✔ ${f}`),
      seoTitle,
      seoDescription: seoDesc,
      cta: platform === "etsy" ? "Download instantly — no physical shipping, no waiting." : "Get instant access — 30-day guarantee.",
      nextSteps: ["Post on Gumroad/Lemon Squeezy with nameOption[1].", `Slots the tagline '${taglines[0]}' in the subtitle.`, "Add 1 demo screenshot or 15s screencast above the fold."],
    });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: pricing_page                                                  */
/* ------------------------------------------------------------------ */
server.tool(
  "pricing_page",
  "Generate a ready-to-publish markdown pricing page from your product and tiers.",
  {
    productName: z.string().describe("Product name"),
    tagline: z.string().describe("One-line value prop"),
    tiers: z.array(z.object({
      name: z.string().describe("Tier name, e.g. 'Good' / 'Pro'"),
      price: z.string().describe("Price label, e.g. '$19' or '$9/mo'"),
      features: z.string().describe("Comma-separated features for this tier"),
      highlighted: z.boolean().optional().describe("Mark the recommended tier"),
    })).min(1).max(4).describe("Tier list (recommended: 2-3 tiers)"),
    guarantee: z.string().optional().describe("Guarantee text (default 30-day)"),
  },
  async ({ productName, tagline, tiers, guarantee = "30-day money-back guarantee" }) => {
    const blocks = tiers.map((t) => [
      `### ${t.name} — ${t.price}${t.highlighted ? "  ⭐ Recommended" : ""}`,
      "",
      ...t.features.split(",").map((f) => `- ${f.trim()}`),
    ].join("\n"));
    const page = [
      `# ${productName}`,
      "",
      `> ${tagline}`,
      "",
      "---",
      "",
      "## Choose your plan",
      "",
      blocks.join("\n\n"),
      "",
      "---",
      "",
      `**${guarantee}** — if it's not for you, reply to your receipt within 30 days for a full refund, no quiz.`,
      "",
      "*Questions? DM me — happy to help you pick.*",
    ].join("\n");
    return json({ markdown: page });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: launch_plan                                                   */
/* ------------------------------------------------------------------ */
server.tool(
  "launch_plan",
  "A week-by-week go-to-market checklist for a digital product, from listing to first sales to iteration.",
  {
    product: z.string().describe("Product name"),
    platform: z.string().optional().describe("Primary sales platform (default 'Gumroad or Lemon Squeezy')"),
    launchType: z.enum(["soft", "producthunt", "newsletter"]).optional().describe("Launch style (default soft)"),
  },
  async ({ product, platform = "Gumroad or Lemon Squeezy", launchType = "soft" }) => {
    const plan = [
      { week: "Day 0-1 · Setup", tasks: [
        `Create the ${platform} account + payment details.`,
        "Upload listing with copy from listing_copy: name, tagline, description, 3 screenshots/1 demo.",
        "Set the 3 tiers (pricing_strategy) and the 30-day guarantee line.",
        "Add a welcome email that delivers the files + a 1-page 'how to use' quickstart.",
      ] },
      { week: "Week 1 · First distribution", tasks: [
        "Post to the 2 most relevant free channels from free_platforms_playbook (answer a question first, then mention the product once).",
        "Tell your existing circle: 1 post, no pressure.",
        `Goal: ${launchType === "producthunt" ? "get 2-5 test buyers and fix anything rough before the Hunt" : "3-10 sales or 20+ interested followers."}`,
      ] },
      { week: "Week 2 · Feedback + proof", tasks: [
        "DM 2-3 buyers: 'what did you get stuck on?' — fix the top reply in an update.",
        "Collect 1-2 short testimonials (it's fine to ask).",
        "Add testimonials + updated screenshots to the listing.",
      ] },
      { week: "Week 3 · Content engine", tasks: [
        "Publish 2 pieces of value content tied to the product (walkthrough, tutorial, result post).",
        "Drop 2 helpful answers in communities where your audience hangs out (link only if asked).",
        launchType === "producthunt" ? "Prepare the Product Hunt launch: hunter, banner, 3 comments ready." : "Optional: schedule a Reddit 'Show HN'-style post if allowed by the sub's rules.",
      ] },
      { week: "Week 4 · Iterate", tasks: [
        "Review revenue_projection vs reality: if under 5 sales, lower the entry tier or test a bundle; if selling, raise the top tier.",
        "Start the maintenance_loop so the income keeps running while you build the next product.",
      ] },
    ];
    return json({ product, launchType, weeks: plan, northStar: "First goal: 10 sales. Second goal: 10 sales/month on autopilot. Everything else is iteration." });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: free_platforms_playbook                                       */
/* ------------------------------------------------------------------ */
server.tool(
  "free_platforms_playbook",
  "Curated free platforms + what to post and how to structure ads/outreach for a digital product.",
  {
    productType: z.enum(["digital-download", "software-tool", "course", "merch", "service"]).describe("What you're selling"),
    niche: z.string().describe("Your niche, e.g. 'AI tools for solo founders'"),
  },
  async ({ productType, niche }) => {
    const playbook = {
      "digital-download": [
        { platform: "Gumroad / Lemon Squeezy", cost: "Free to list (fee per sale)", move: "Your storefront. Customize the page, add a demo, enable discount codes.", cadence: "Update the listing monthly; run a launch discount for email list." },
        { platform: "Etsy (digital)", cost: "~$0.20 listing + ~6.5% per sale", move: "If your product is a template/pack buyers search for ('notion template', 'printable planner'). SEO inside Etsy matters more than anything.", cadence: "5 listings, refresh thumbnails quarterly." },
        { platform: "Pinterest", cost: "Free", move: "Create 5 pins (before/after or checklist visuals) linking to your listing — Pinterest is a search engine, not social.", cadence: "3 pins/week for 6 weeks." },
        { platform: "Reddit / niche forums", cost: "Free", move: "Answer real questions in your niche; mention your product only when it directly answers the ask, per sub rules.", cadence: "2 valuable answers/week. No links in most subs — build trust first." },
        { platform: "YouTube Shorts / TikTok", cost: "Free", move: "15-30s 'here's the result' clips. Ad placement: pinned comment with link.", cadence: "2-3 clips/week." },
      ],
      "software-tool": [
        { platform: "GitHub", cost: "Free", move: "Open-core: public repo with README demo = free traffic + trust. npm/PyPI listing piggybacks on this.", cadence: "Changelog updates each release." },
        { platform: "Product Hunt / Indie Hackers", cost: "Free for launch", move: "One strong launch day with a demo video gets you the first 100 eyeballs.", cadence: "Once per product launch." },
        { platform: "Reddit r/selfhosted, r/artificial, tool subs", cost: "Free", move: "Share the 'how I built this' story; link politely per sub rules.", cadence: "1 story post per launch." },
        { platform: "X/Twitter (build-in-public)", cost: "Free", move: "Daily 1-liners about building/selling — the audience that follows indie tools is your buyer pool.", cadence: "3-5 threads/week." },
        { platform: "dev.to / Medium", cost: "Free", move: "Tutorial SEO: 'How I use X to do Y'. Long-tail search brings buyers for months.", cadence: "1 article/month." },
      ],
      "course": [
        { platform: "YouTube", cost: "Free", move: "Turn the first module into free lessons; the paid course lives on your listing.", cadence: "1 lesson/week." },
        { platform: "Udemy (promo model)", cost: "Free to publish", move: "Coupon-based pricing to collect reviews; direct sales elsewhere for margin.", cadence: "Launch once, update yearly." },
        { platform: "Newsletter (Beehiiv/Substack)", cost: "Free tier", move: "Email list = repeat buyers + course upsells. Ad placement: 1 mention per issue max.", cadence: "1 issue/week." },
      ],
      "merch": [
        { platform: "Print-on-demand (Redbubble, TeePublic, Printful)", cost: "Free to start", move: "Upload designs; they handle production. Your margin is the design.", cadence: "Batch 10-20 designs, refresh monthly." },
        { platform: "Etsy + Printful", cost: "Listing fees per item", move: "Higher margin than Redbubble; SEO: niche design names ('gamer dad shirt').", cadence: "Add 3 designs/week." },
        { platform: "Pinterest / Instagram", cost: "Free", move: "Pin design mockups with shop links.", cadence: "3 pins/week." },
      ],
      "service": [
        { platform: "LinkedIn", cost: "Free", move: "Case-study posts; DM outreach only to people who engaged (the leadgen MCP finds these).", cadence: "2 posts/week." },
        { platform: "Upwork/Fiverr", cost: "Free to start (fee per gig)", move: "One well-written gig + portfolio beats 10 gigs. Escalate prices as reviews land.", cadence: "Update gig quarterly." },
        { platform: "Local/niche communities", cost: "Free", move: "Help visibly, then 'open to 2 clients this month'.", cadence: "Weekly." },
      ],
    };
    const rows = (playbook[productType] || playbook["digital-download"]).map((r) => ({ ...r, adOrOutreach: r.move.includes("Ad") ? r.move : `Outreach: ${r.move.replace(/\.$/, "")}; direct ads only after you have proof of conversions.` }));
    return json({
      niche, productType,
      rule: "Every free platform is a channel you already own: give value first, sell every 10th touch. Paid ads only after organic converts.",
      channels: rows,
      seoNote: `For ${niche}: long-tail = the questions people actually type ('how do I X for ${niche.toLowerCase()}'). One SEO article/pin answering it beats ten generic posts.`,
    });
  }
);

/* ------------------------------------------------------------------ */
/* Tool: maintenance_loop                                              */
/* ------------------------------------------------------------------ */
server.tool(
  "maintenance_loop",
  "The recurring/passive income cadence: what to check weekly, monthly and quarterly so the machine keeps running without you.",
  {
    product: z.string().describe("Product name"),
    salesPerMonth: z.number().min(0).optional().describe("Current monthly sales count, to tailor the loop"),
  },
  async ({ product, salesPerMonth = 0 }) => {
    return json({
      product,
      weekly30min: [
        "Reply to buyer DMs/emails (highest lever — one reply can become a testimonial or upsell).",
        "Post 2 value pieces on your best channel (playbook cadence).",
        "Check sales + refunds: any pattern? Fix the top complaint in the next update. ",
      ],
      monthly1h: [
        "Ship 1 small update (new feature, new tier, refreshed screenshots) — past buyers see it as ongoing value; this alone drives repeat sales.",
        "Refresh the listing: tweak SEO title, add a testimonial, bump the top-tier price up 10% if sales are steady.",
        "Run one discount (e.g. 20% off for 72h) for your email list / followers.",
      ],
      quarterly2h: [
        "Review revenue_projection vs actual; kill what's dead, double down on what's working.",
        "Bundle check: can two of your products become a higher-priced bundle?",
        "Write one SEO article/pin that links to the listing.",
      ],
      automation: [
        "Gumroad/Lemon Squeezy handle checkout + delivery + receipts automatically — that's the passive part.",
        "Welcome email auto-delivers files and asks one question ('what are you trying to do?') to feed future content.",
        "Sooner than you think: past buyers list (email export) is the seed of a paid-product newsletter.",
      ],
      northStar: `${product} at ${salesPerMonth || 0}/mo now → target 10/mo. At 10/mo you can add a second product to the loop; the loop is the business.`,
    });
  }
);

/* ------------------------------------------------------------------ */
const transport = new StdioServerTransport();
await server.connect(transport);