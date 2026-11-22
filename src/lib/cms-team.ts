/**
 * CMS Sales Team roster (provided by the manager).
 * Used by the Members section filter so the team lead can view
 * only the CMS sales members. Matching is punctuation/space tolerant:
 * "Md. Keramot Ali" (sheet) and "Md Keramot Ali" (import) resolve to the same key.
 */
export const CMS_SALES_TEAM: string[] = [
  "Md. Keramot Ali",
  "Shishir Chowdhory",
  "Ashraful Alam",
  "Mubarok Hosen",
  "Tashiba",
  "Asif Ibne Kamal",
  "Minal Mridha Nayan",
  "Srabonti Ghosh Diba",
  "Rakibul Islam",
  "Kaniz Fatema",
  "Md Rifat Hossain",
  "Rakib Md Osman Faruque",
  "Md. Anisur Rahman",
  "Ishtiak Ahmed",
  "Md Jahidul Hasan",
  "Sharna Cathrina Dias",
  "Shihab Alam Khan",
  "Abir Hasan Akash",
  "Jubeyar",
  "Md. Majedul Islam",
  "Md. Ismail",
  "Meherab Hosen Biplov",
  "Sanjida Rahman Autri",
  "Md. Assaduzzaman",
  "Bodruzzaman Nasim",
  "Elio Costa",
  "Yusuf Ahmed",
];

/** Normalize a person name for comparison: lowercase, strip punctuation, collapse spaces. */
export function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CMS_KEYS = new Set(CMS_SALES_TEAM.map(normKey));

/** True if the given (sheet/import) member name belongs to the CMS sales roster. */
export function isCmsSalesMember(name: string): boolean {
  return CMS_KEYS.has(normKey(name));
}
