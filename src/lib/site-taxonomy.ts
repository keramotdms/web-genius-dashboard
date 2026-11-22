/**
 * Reference-website taxonomy — 3 levels + big-client labels:
 *
 *   Level 1 — CMS Category (platform):   WordPress / Wix / Shopify / Squarespace / Webflow
 *   Level 2 — Website Category:          the TYPE of website (E-commerce Based, News Portal,
 *                                        LMS, Landing Page, … — 20 fixed buckets)
 *   Level 3 — Business Name Category:    what the business actually is (Housekeeping & Cleaning
 *                                        Services, Legal Services, Bakery Shop, "X News Paper"…)
 *   Labels — big-client hunting flags:   Premium Website / Large Website / High Value Project's
 *                                        Website (a site can carry several labels at once)
 *
 * Classification is rule-based: website-type rules + business rules are matched against the
 * sheet's original category text + the site's URL. The first hit wins, so specific niches must
 * come before broader patterns. Anything unmatched falls back to a platform default
 * (Shopify → E-commerce store, WordPress → company profile) and can later be refined by the AI
 * categorizer or by hand.
 */

export interface SiteClass {
  websiteCategory: string;
  businessCategory: string;
}

/** Level 1 — CMS platforms in filter order ("Other" = unknown CMS). */
export const CORE_PLATFORMS = ["WordPress", "Wix", "Shopify", "Squarespace", "Webflow", "Other"];

/** Level 2 — the 20 website categories, exactly as the team defined them. */
export const WEBSITE_CATEGORIES = [
  "E-commerce Based (Product Selling) Website",
  "Dropshipping / Affiliate Marketing Website",
  "Professional Service-Based Website",
  "Agency (Agency Business-Based) Website",
  "Corporate / Company Profile Website",
  "Portfolio (Personal / Creative) Website",
  "News Portal Website",
  "Blog / Magazine Website",
  "LMS (Learning Management System) Website",
  "Landing Page Website",
  "Sales Funnel Website",
  "SaaS (Software as a Service) Website",
  "Membership / Subscription Website",
  "Booking / Appointment Website",
  "Real Estate / Property Listing Website",
  "Directory / Listing Website",
  "Job Portal Website",
  "Event / Conference Website",
  "Forum / Community Website",
  "Non-Profit / NGO / Charity Website",
];

/** Compact badge labels for the 20 website categories (full name stays in tooltips/selects). */
export const WEBSITE_SHORT_NAMES: Record<string, string> = {
  "E-commerce Based (Product Selling) Website": "E-commerce",
  "Dropshipping / Affiliate Marketing Website": "Dropshipping / Affiliate",
  "Professional Service-Based Website": "Service-Based",
  "Agency (Agency Business-Based) Website": "Agency",
  "Corporate / Company Profile Website": "Corporate Profile",
  "Portfolio (Personal / Creative) Website": "Portfolio",
  "News Portal Website": "News Portal",
  "Blog / Magazine Website": "Blog / Magazine",
  "LMS (Learning Management System) Website": "LMS",
  "Landing Page Website": "Landing Page",
  "Sales Funnel Website": "Sales Funnel",
  "SaaS (Software as a Service) Website": "SaaS",
  "Membership / Subscription Website": "Membership",
  "Booking / Appointment Website": "Booking",
  "Real Estate / Property Listing Website": "Real Estate Listing",
  "Directory / Listing Website": "Directory",
  "Job Portal Website": "Job Portal",
  "Event / Conference Website": "Event / Conference",
  "Forum / Community Website": "Forum / Community",
  "Non-Profit / NGO / Charity Website": "Non-Profit / NGO",
};

export function shortWebsiteCategory(cat: string): string {
  return WEBSITE_SHORT_NAMES[cat] ?? cat;
}

/**
 * Level 3 — Business Name categories, grouped for the picker UI only (the stored
 * value is always the flat business-name string). The first groups follow the
 * team's own list; the later groups keep the extra niches the existing library
 * was already classified with so no old data becomes orphaned.
 */
export const BUSINESS_CATEGORY_GROUPS: Array<{ group: string; items: string[] }> = [
  {
    group: "Home & Lifestyle",
    items: [
      "Housekeeping & Cleaning Services",
      "Laundry & Dry Cleaning Services",
      "Pest Control Services",
      "Gardening & Landscaping Services",
      "Plumbing Services",
      "Electrical Services",
      "HVAC Services",
      "Handyman Services",
      "Painting & Decorating Services",
      "Moving & Storage Services",
      "Furniture Assembly & Repair Services",
      "Appliance Repair Services",
      "Pool Cleaning & Maintenance Services",
    ],
  },
  {
    group: "Automotive",
    items: [
      "Car Washing & Detailing",
      "Oil Change & Lube Services",
      "Tire Repair & Replacement",
      "Car Repair & Maintenance Services",
      "Towing & Recovery Services",
    ],
  },
  {
    group: "Professional Services",
    items: [
      "Legal Services",
      "Accounting & Tax Services",
      "Financial Planning",
      "Insurance Services",
      "IT Support & Consulting",
      "Business Consulting Services",
      "Staffing & Recruitment Services",
      "Tutoring & Education Services",
      "Translation & Interpretation Services",
      "Delivery & Courier Services",
      "Catering & Event Planning",
      "Car Rental & Leasing",
      "Travel & Tour Services",
      "Real Estate Services",
      "Web Design & Development",
      "Digital Marketing",
      "Graphic Design",
    ],
  },
  {
    group: "Creative & Digital Agencies",
    items: [
      "Advertising Agencies",
      "Digital Marketing Agencies",
      "Public Relations Agencies",
      "Web Agency",
    ],
  },
  {
    group: "Real Estate",
    items: ["Residential Real Estate", "Commercial Real Estate"],
  },
  {
    group: "Retail & E-commerce Stores",
    items: [
      "Electronics",
      "Fashion",
      "Home & Kitchen",
      "Books, Media & Games",
      "Health & Beauty",
      "Grocery & Food",
      "Automotive",
      "Baby & Kids",
      "Jewelry & Accessories",
      "Pet Supplies",
      "Gifts & Seasonal",
      "Art & Handmade",
      "Sports & Outdoors",
      "General Ecommerce",
    ],
  },
  {
    group: "Personal Care & Wellness",
    items: [
      "Hair Salon & Styling",
      "Barber Shop",
      "Nail Salon",
      "Spa & Massage Therapy",
      "Skin Care & Beauty Studio",
      "Gym & Fitness Training",
      "Yoga & Meditation Studio",
      "Weight Loss & Nutrition Coaching",
      "Mental Health & Counseling",
    ],
  },
  {
    group: "Food, Events & Other",
    items: [
      "Restaurant & Cafe",
      "Bakery Shop",
      "Photography & Videography",
      "Event Management",
      "Pet Care Services",
      "Security Services",
      "Construction & Renovation",
      "Transportation Services",
      "Printing & Signage",
      "Education & Childcare",
      "Healthcare & Medical",
      "General Business",
    ],
  },
];

/** Flat suggestion list for pickers (custom free-text names are always allowed on top). */
export const BUSINESS_CATEGORIES: string[] = BUSINESS_CATEGORY_GROUPS.flatMap((g) => g.items);

/** Big-client hunting labels — a website can carry any combination of them. */
export const SITE_LABELS = ["Premium Website", "Large Website", "High Value Project's Website"];

/** Business names that mean "not classified yet" — the AI categorizer re-refines these. */
export const GENERIC_BUSINESS = new Set(["General Ecommerce", "General Business", "Uncategorized"]);

export function isGenericBusiness(business: string): boolean {
  return GENERIC_BUSINESS.has(business);
}

/** ── one-time data migration: old level-2 sectors → new website categories ── */
export const LEGACY_MAIN_TO_WEBSITE: Record<string, string> = {
  Ecommerce: "E-commerce Based (Product Selling) Website",
  "Professional Services": "Professional Service-Based Website",
  "Home & Lifestyle Services": "Professional Service-Based Website",
  "Creative Agencies": "Agency (Agency Business-Based) Website",
  "Real Estate Agencies": "Real Estate / Property Listing Website",
  "Personal Care & Wellness": "Professional Service-Based Website",
  "Automotive Services": "Professional Service-Based Website",
  "Other Services": "Professional Service-Based Website",
};

/** ── classification ── */

const PLATFORM_FALLBACK: Record<string, SiteClass> = {
  Shopify: { websiteCategory: "E-commerce Based (Product Selling) Website", businessCategory: "General Ecommerce" },
  Squarespace: { websiteCategory: "E-commerce Based (Product Selling) Website", businessCategory: "General Ecommerce" },
  WordPress: { websiteCategory: "Corporate / Company Profile Website", businessCategory: "General Business" },
  Wix: { websiteCategory: "Corporate / Company Profile Website", businessCategory: "General Business" },
  Webflow: { websiteCategory: "Corporate / Company Profile Website", businessCategory: "General Business" },
  Other: { websiteCategory: "Corporate / Company Profile Website", businessCategory: "General Business" },
};

/** Category labels whose full multi-line text is noise — classify on the label only. */
const NOISY_CATEGORY_RE =
  /^(multiple|general|top (five|5)[^.]*|top picks|top-?5.*|categories|website url|categro?y)$/i;

const ECOMMERCE_BUSINESS = new Set([
  "Electronics", "Fashion", "Home & Kitchen", "Books, Media & Games", "Health & Beauty",
  "Grocery & Food", "Automotive", "Baby & Kids", "Jewelry & Accessories", "Pet Supplies",
  "Gifts & Seasonal", "Art & Handmade", "Sports & Outdoors", "General Ecommerce",
]);
const AGENCY_BUSINESS = new Set([
  "Advertising Agencies", "Digital Marketing Agencies", "Public Relations Agencies", "Web Agency",
]);
const REAL_ESTATE_LISTING = new Set(["Residential Real Estate", "Commercial Real Estate"]);
const PORTFOLIO_BUSINESS = new Set(["Photography & Videography"]);

/** Default website type implied by the business itself (used when no type rule hits). */
function defaultWebsiteForBusiness(business: string): string {
  if (ECOMMERCE_BUSINESS.has(business)) return "E-commerce Based (Product Selling) Website";
  if (AGENCY_BUSINESS.has(business)) return "Agency (Agency Business-Based) Website";
  if (REAL_ESTATE_LISTING.has(business)) return "Real Estate / Property Listing Website";
  if (PORTFOLIO_BUSINESS.has(business)) return "Portfolio (Personal / Creative) Website";
  if (business === "General Business") return "Corporate / Company Profile Website";
  if (BUSINESS_CATEGORIES.includes(business)) return "Professional Service-Based Website";
  return ""; // unknown/custom business → platform fallback
}

/**
 * [pattern, websiteCategory] — website-TYPE signals. Checked in order, first hit wins.
 * Kept deliberately tighter than the business rules so service-business wording
 * ("event planning", "real estate attorney", "community center") is not misread
 * as a website type.
 */
const WEBSITE_TYPE_RULES: Array<[RegExp, string]> = [
  [/news\s*-?\s*portal|newspaper|\bnews\b|gazette|tribune|herald|\btimes\b/, "News Portal Website"],
  [/\bblog\b|magazine|\bvlog\b/, "Blog / Magazine Website"],
  [/\blms\b|learning ?management|e-?learning|online ?courses?\b|course ?(platform|builder|website|app)|mooc|thinkific|teachable|kajabi|coursecompass/, "LMS (Learning Management System) Website"],
  [/drop ?ship|dropship|affiliate|aliexpress|amazon ?(affiliate|associates)|\bclickbank\b|cashback|review ?(site|website)/, "Dropshipping / Affiliate Marketing Website"],
  [/sales ?funnel|\bfunnel\b|clickfunnels|leadpages|unbounce/, "Sales Funnel Website"],
  [/landing ?page|one-?page ?(site|website)|instapage/, "Landing Page Website"],
  [/\bsaas\b|software ?as ?a ?service|\bcrm\b|\berp\b|\bhrm\b|helpdesk|project ?management ?(tool|software|app)/, "SaaS (Software as a Service) Website"],
  [/membership|members ?(only|area|zone)|paywall|subscriber ?(only|content)|subscribers ?(only|area)/, "Membership / Subscription Website"],
  [/\bbook ?(now|online)\b|appointment|reservation|calendly|schedul(e|ing) ?(now|online)/, "Booking / Appointment Website"],
  [/property ?(listing|search|portal)|mls\b|\bzillow\b|realtor|realty|homes ?(for ?sale|search)/, "Real Estate / Property Listing Website"],
  [/directory|yellow ?pages|\byelp\b|find ?(a|an) ?(pro|business|contractor)/, "Directory / Listing Website"],
  [/job ?(portal|board|listing|search|vacanc)|\bjobs?\b ?(portal|board)|career ?(portal|board)|vacanc/, "Job Portal Website"],
  [/conference|summit|webinar|\bexpo\b|trade ?(show|fair)|eventbrite|tickets? ?(buy|sale|purchase)|upcoming ?events?|event ?(website|page|portal)/, "Event / Conference Website"],
  [/\bforum\b|discussion ?board|buddypress|bbpress|\bdiscourse\b|community ?(forum|portal|site)/, "Forum / Community Website"],
  [/\bngo\b|non-?profit|charit|donat(e|ion)|fundrais|crowdfund|gofundme|\bfoundation\b/, "Non-Profit / NGO / Charity Website"],
  [/portfolio|personal ?(brand|site|website)|resume|\bcv\b/, "Portfolio (Personal / Creative) Website"],
  [/corporate|company ?profile/, "Corporate / Company Profile Website"],
  [/e-?commerce|online ?(store|shop|shopping)|myshopify|shopping ?(cart|site|store)|\bwebshop\b|storefront/, "E-commerce Based (Product Selling) Website"],
];

/**
 * [pattern, businessCategory] — what the BUSINESS is. Ordered: specific product
 * niches → services → agencies → broad ecommerce. First hit wins.
 */
const BUSINESS_RULES: Array<[RegExp, string]> = [
  // ── Tier 1: specific product niches (these beat generic labels) ──
  [/jewel|jewellery|gemstone|diamond|silverman|charmed|ferreol|normansilverman|aquagold/, "Jewelry & Accessories"],
  [/pet ?(supplies|food|store|shop|toys|products)|reptile|\bdog\b|dogs\b|puppy|ferret|aquarium|pawprint|tomedogtoys|bayntons/, "Pet Supplies"],
  [/christmas|gift|hamper|basket\b|chachisbasket|gifts4every|party ?(store|supply|shop)/, "Gifts & Seasonal"],
  [/handmade|handcrafted|hand ?craft|artwork|artist|embroider|stitch|painted|candle|scent|fragrance/, "Art & Handmade"],
  [/honey|loaf|snack|superfin\b|onepiacere|spirits|whisk?ey|wine\b|vineyard|brewer|distiller|atherasspirits/, "Grocery & Food"],
  [/vitamin|supplement|nutra|viteralabs|apoth|wellness ?product|\blabs?\b/, "Health & Beauty"],
  [/aesop|beekman|raesoskin/, "Health & Beauty"],
  [/thrudark|tactical|military|hardgraft|porterandyork|allbirds/, "Fashion"],
  [/car ?parts|auto ?parts|motorcycle ?(gear|parts)|tire ?(sale|shop)/, "Automotive"],
  [/sport(ing)? ?(equipment|gear|goods)|camping ?gear|outdoor ?gear|\bgym\b ?(equipment|gear)/, "Sports & Outdoors"],

  // ── Tier 2: home & lifestyle services ──
  [/pool (clean|service|maintenance|repair)/, "Pool Cleaning & Maintenance Services"],
  [/housekeep|cleaning|maids?\b|safai|janitor/, "Housekeeping & Cleaning Services"],
  [/laundry|dry ?clean|laundromat/, "Laundry & Dry Cleaning Services"],
  [/pest ?control|exterminat|fumigat/, "Pest Control Services"],
  [/garden|landscap|lawn ?(care|mowing|service)|tree (service|care)|arborist/, "Gardening & Landscaping Services"],
  [/plumb|plumber|pipe ?(repair|fix)/, "Plumbing Services"],
  [/electric(al|ian)? ?(service|repair|work|ian)|\belectrician\b|wir ?ing/, "Electrical Services"],
  [/hvac|air ?condition|heating|cooling|furnace|ventilation/, "HVAC Services"],
  [/handy ?man|odd ?jobs/, "Handyman Services"],
  [/paint(er|ing)|decorat/, "Painting & Decorating Services"],
  [/moving|movers\b|relocation|storage ?(unit|facility|service)/, "Moving & Storage Services"],
  [/furniture (assembl|repair|disassembl|fix)/, "Furniture Assembly & Repair Services"],
  [/appliance (repair|fix|service)/, "Appliance Repair Services"],

  // ── Tier 2: automotive services ──
  [/car ?wash|detailing|valet ?(park|service)?/, "Car Washing & Detailing"],
  [/oil ?change|\blube\b/, "Oil Change & Lube Services"],
  [/\btire\b|\btyre\b/, "Tire Repair & Replacement"],
  [/towing|tow (truck|service)|recovery ?service/, "Towing & Recovery Services"],
  [/auto ?repair|car ?(repair|service|maintenance)|mechanic|motor ?repair|brakes?\b|transmission|vehicle ?(service|repair|maintenance)/, "Car Repair & Maintenance Services"],

  // ── Tier 2: creative agencies (before standalone marketing so "agency" wins) ──
  [/public ?relations|pr ?agency/, "Public Relations Agencies"],
  [/advertis/, "Advertising Agencies"],
  [/agency.*(marketing|seo|ppc|branding|social)|(marketing|seo|ppc|branding|social).*(agency|agencies)/, "Digital Marketing Agencies"],
  [/(web|design|develop|creative|digital).*(agency|agencies)|(agency|agencies).*(web|design|develop|creative)|web ?agency|digital ?agency/, "Web Agency"],

  // ── Tier 2: professional services ──
  [/\blaw\b|law(yer|firm|office|associat|group)|legal|attorney|advocate|crouppen|rossmanlaw/, "Legal Services"],
  [/account|\btax\b|\bcpa\b|bookkeep/, "Accounting & Tax Services"],
  [/financial ?plan|wealth ?manage|investment ?advis|asset ?manage/, "Financial Planning"],
  [/insur|claimpro/, "Insurance Services"],
  [/property ?manage|home ?inspect|property ?inspect|real estate (service|consult|valua)/, "Real Estate Services"],
  [/it ?support|tech ?support|\bit\b ?(consult|service)|cyber|data ?recovery|hosting|network ?(service|support)/, "IT Support & Consulting"],
  [/tutor|tuition|education ?(service|center)|academy|school|lesson|online ?course/, "Tutoring & Education Services"],
  [/translat|interpret/, "Translation & Interpretation Services"],
  [/courier|delivery ?service|parcel ?service|shipping ?service|logistics|\bfreight\b/, "Delivery & Courier Services"],
  [/cater|event ?plan/, "Catering & Event Planning"],
  [/car (rental|hire|lease)|vehicle ?rental|rent ?a ?car|leasing/, "Car Rental & Leasing"],
  [/travel|tourism|\btour\b|trip\b|vacation ?package|holiday ?package/, "Travel & Tour Services"],
  [/staffing|recruit|elitesigning/, "Staffing & Recruitment Services"],
  [/consult|advisor|strategist/, "Business Consulting Services"],
  [/web ?design|web ?dev|website ?design|app ?development|software ?development|wordpress ?dev/, "Web Design & Development"],
  [/digital ?marketing|\bseo\b|\bppc\b|social ?media ?market|branding|lead ?gen|growth ?(hack|market)/, "Digital Marketing"],
  [/graphic ?design|logo ?design|illustrat|animation|brand ?identity/, "Graphic Design"],

  // ── Tier 2: real estate ──
  [/commercial (real ?estate|property|office ?space)|industrial ?property/, "Commercial Real Estate"],
  [/real ?estate|realty|realtor|property|housing|apartment|estate\b|\bhoa\b|searchhoa|sterlingjasper/, "Residential Real Estate"],

  // ── Tier 2: personal care & wellness ──
  [/salon|hair ?(cut|stylist|salon|dresser|style)|hairstyle|beautybuzz|agasiaura|beyondthechair/, "Hair Salon & Styling"],
  [/barber/, "Barber Shop"],
  [/nail|manicure|pedicure/, "Nail Salon"],
  [/spa\b|massage/, "Spa & Massage Therapy"],
  [/skin ?care|facial|beauty (studio|clinic|lounge)|aesthetic/, "Skin Care & Beauty Studio"],
  [/gym\b|fitness|personal ?train|crossfit|relentlessperformance|performance ?training/, "Gym & Fitness Training"],
  [/yoga|pilates|meditation/, "Yoga & Meditation Studio"],
  [/weight ?loss|nutrition|diet\b/, "Weight Loss & Nutrition Coaching"],
  [/clinic|dental|dentist|medical|healthcare|doctor|hospital|hospice|patient|medhub|physio|old age|home ?care/, "Healthcare & Medical"],
  [/counsel|mental ?health|therap/, "Mental Health & Counseling"],

  // ── Tier 2: food, events & other ──
  [/restaurant|cafe\b|coffee ?shop|pizzeria|diner|bistro|food ?menu|sunflowers/, "Restaurant & Cafe"],
  [/baker|cake\b|patisserie|dessert|chickpea/, "Bakery Shop"],
  [/photograph|photo ?studio|videograph|wedding ?film|mural|duelmen|sonjava|portfolio/, "Photography & Videography"],
  [/event ?manage|wedding ?plan|balloon|photobooth|halloween|hiddenlake|phenomenal/, "Event Management"],
  [/pet (care|groom|sitting|walk|hotel|clinic)|\bvet\b|veterinar/, "Pet Care Services"],
  [/security (service|system|agency)|\bcctv\b|guard ?(service|ing)/, "Security Services"],
  [/construct|renovat|roof(ing)?\b|remodel|builder|contractor|homerenewal|classicland|duralux/, "Construction & Renovation"],
  [/transport|taxi|chauffeur|rideshare|\btruck\b/, "Transportation Services"],
  [/print|signage|banner ?(print|shop)/, "Printing & Signage"],
  [/childcare|day ?care|preschool|kindergarten|eseaclub/, "Education & Childcare"],

  // ── Tier 3: broad ecommerce (after services so service wording wins) ──
  [/fashion|apparel|clothing|clothes|outfit|wardrobe|\bwear\b|boutique|thread|atelier|revonoi|dfyne|grandeluxe|khanluxe|memotivo|lunarnco|wrldinvsn|evolve|\bshoe|sneaker|footwear/, "Fashion"],
  [/jewel/, "Jewelry & Accessories"],
  [/cosmetic|skincare|skin ?care|makeup|\blash\b|hair ?(care|product)|perfume|benirlaveau|beauty\b/, "Health & Beauty"],
  [/electronic|gadget|toxwipe|mikesdiscount|headphone|camera\b/, "Electronics"],
  [/\bbooks?\b|bookshop|bookstore|\bmedia\b|novel|\bgame\b|gaming/, "Books, Media & Games"],
  [/toys|children|\bbaby\b|\bkids?\b/, "Baby & Kids"],
  [/grocery|supermarket|coffee|tea\b|organic ?(food|store)|food ?(store|delivery|shop)/, "Grocery & Food"],
  [/furniture|chair|sofa|couch|table\b|decor|curtain|blind|wallpaper|shade|rug\b|rugs\b|carpet|houseware|kitchenware|leonyxhome|nextgenchairs|morekot|lambje|yourhomedecor|modsavy|watermark/, "Home & Kitchen"],
  [/myshopify|ecommerce|e-commerce|online ?store|\bshop\b|\bstore\b/, "General Ecommerce"],
];

function classifyBusiness(hay: string, platform: string): string {
  for (const [re, business] of BUSINESS_RULES) {
    re.lastIndex = 0;
    if (re.test(hay)) return business;
  }
  const fb = PLATFORM_FALLBACK[platform] ?? PLATFORM_FALLBACK.Other;
  return fb.businessCategory;
}

function classifyWebsiteType(hay: string, platform: string, business: string): string {
  for (const [re, website] of WEBSITE_TYPE_RULES) {
    re.lastIndex = 0;
    if (re.test(hay)) return website;
  }
  const fromBusiness = defaultWebsiteForBusiness(business);
  if (fromBusiness) return fromBusiness;
  const fb = PLATFORM_FALLBACK[platform] ?? PLATFORM_FALLBACK.Other;
  return fb.websiteCategory;
}

export function classifySite(
  platform: string,
  categoryText: string,
  url: string
): SiteClass {
  // strip protocol but KEEP the path so slug keywords like /cleaning-service count
  const urlText = url.replace(/^https?:\/\//i, "").toLowerCase();

  const firstLine = (categoryText.split("\n")[0] ?? "").trim();
  const cat = NOISY_CATEGORY_RE.test(firstLine) ? firstLine : categoryText;
  const hay = `${cat} ${urlText}`.toLowerCase();

  const businessCategory = classifyBusiness(hay, platform);
  const websiteCategory = classifyWebsiteType(hay, platform, businessCategory);
  return { websiteCategory, businessCategory };
}

/** Is this a website category from the official list of 20? */
export function isValidWebsiteCategory(v: string): boolean {
  return WEBSITE_CATEGORIES.includes(v);
}

/** Business names are free-text (team asked for names like "X News Paper") — only sanitize. */
export function sanitizeBusinessCategory(v: string): string {
  return v.replace(/[\n\r]+/g, " ").trim().slice(0, 80);
}

export function sanitizeLabels(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((l) => String(l).trim()).filter((l) => SITE_LABELS.includes(l)))];
}
