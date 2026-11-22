/**
 * Quick sanity check for the 3-level site taxonomy classifier.
 * Run: bun scripts/test-taxonomy.ts
 */
import { classifySite, WEBSITE_CATEGORIES, BUSINESS_CATEGORIES } from "../src/lib/site-taxonomy";

const CASES: Array<[string, string, string, string, string]> = [
  // [url, platform, categoryText, expectedWebsite, expectedBusiness]
  ["https://sparkle-cleaning-pros.com", "WordPress", "", "Professional Service-Based Website", "Housekeeping & Cleaning Services"],
  ["https://freshfoldlaundry.com", "Wix", "Laundry service", "Professional Service-Based Website", "Laundry & Dry Cleaning Services"],
  ["https://plumbright.com/services", "WordPress", "", "Professional Service-Based Website", "Plumbing Services"],
  ["https://coolairhvac.example.com", "WordPress", "Air conditioning repair", "Professional Service-Based Website", "HVAC Services"],
  ["https://poolmateservices.com", "WordPress", "Pool cleaning service", "Professional Service-Based Website", "Pool Cleaning & Maintenance Services"],
  ["https://shineautodetailing.com", "Wix", "", "Professional Service-Based Website", "Car Washing & Detailing"],
  ["https://towmaster.example.com", "WordPress", "Towing service", "Professional Service-Based Website", "Towing & Recovery Services"],
  ["https://smithlawassociates.com", "WordPress", "", "Professional Service-Based Website", "Legal Services"],
  ["https://taxguide-cpa.com", "WordPress", "", "Professional Service-Based Website", "Accounting & Tax Services"],
  ["https://growthclicks.com", "WordPress", "digital marketing agency", "Agency (Agency Business-Based) Website", "Digital Marketing Agencies"],
  ["https://pixelcraftstudio.com", "WordPress", "web design agency", "Agency (Agency Business-Based) Website", "Web Agency"],
  ["https://tutorplusacademy.com", "Wix", "", "Professional Service-Based Website", "Tutoring & Education Services"],
  ["https://luxwatchshop.myshopify.com", "Shopify", "", "E-commerce Based (Product Selling) Website", "General Ecommerce"],
  ["https://gemsandgold.com", "Shopify", "Jewelry store", "E-commerce Based (Product Selling) Website", "Jewelry & Accessories"],
  ["https://petpalace.example.com", "Shopify", "Pet supplies store", "E-commerce Based (Product Selling) Website", "Pet Supplies"],
  ["https://sweettoothbakery.com", "WordPress", "Bakery & cakes", "Professional Service-Based Website", "Bakery Shop"],
  ["https://urbancafe.com", "Wix", "Coffee shop & menu", "Professional Service-Based Website", "Restaurant & Cafe"],
  ["https://glowsalon.com", "Wix", "Hair salon & styling", "Professional Service-Based Website", "Hair Salon & Styling"],
  ["https://ironpitgym.com", "WordPress", "", "Professional Service-Based Website", "Gym & Fitness Training"],
  ["https://skylineproperties.com", "WordPress", "commercial real estate agency", "Real Estate / Property Listing Website", "Commercial Real Estate"],
  ["https://homessale.com", "WordPress", "residential realtor", "Real Estate / Property Listing Website", "Residential Real Estate"],
  ["https://kidstoys.example.com", "Shopify", "", "E-commerce Based (Product Selling) Website", "Baby & Kids"],
  ["https://random-domain-qxz.com", "Other", "", "Corporate / Company Profile Website", "General Business"],
  ["https://anything.myshopify.com", "Shopify", "", "E-commerce Based (Product Selling) Website", "General Ecommerce"],
  // website-type rules
  ["https://dailytimes.example.com", "WordPress", "city news", "News Portal Website", "General Business"],
  ["https://markspix.com", "Wix", "photography portfolio", "Portfolio (Personal / Creative) Website", "Photography & Videography"],
  ["https://bookonline-dentist.example.com", "WordPress", "book an appointment online", "Booking / Appointment Website", "Healthcare & Medical"],
  ["https://charityhope.example.org", "WordPress", "non-profit charity donations", "Non-Profit / NGO / Charity Website", "General Business"],
  ["https://leadsplash.example.com", "Wix", "landing page", "Landing Page Website", "General Business"],
  ["https://coursehub.example.com", "WordPress", "online course platform", "LMS (Learning Management System) Website", "Tutoring & Education Services"],
];

let pass = 0;
let fail = 0;
for (const [url, platform, cat, expWebsite, expBusiness] of CASES) {
  const got = classifySite(platform, cat, url.trim());
  const ok = got.websiteCategory === expWebsite && got.businessCategory === expBusiness;
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL ${url.trim()} → got ${got.websiteCategory} / ${got.businessCategory}, want ${expWebsite} / ${expBusiness}`);
  }
}
console.log(`\n${pass}/${CASES.length} passed, ${fail} failed`);

// taxonomy integrity: website categories + business suggestions are non-empty and unique
const uniqWebsite = new Set(WEBSITE_CATEGORIES);
const uniqBusiness = new Set(BUSINESS_CATEGORIES);
console.log(`website categories: ${WEBSITE_CATEGORIES.length} (${uniqWebsite.size} unique)`);
console.log(`business suggestions: ${BUSINESS_CATEGORIES.length} (${uniqBusiness.size} unique)`);
if (uniqWebsite.size !== WEBSITE_CATEGORIES.length || uniqBusiness.size !== BUSINESS_CATEGORIES.length) {
  console.log("TAXONOMY ERROR: duplicate entries found");
}
