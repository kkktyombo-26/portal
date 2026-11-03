// ─── Church Constants ─────────────────────────────────────────────────────────
// Shared lookup data used across member forms and admin modals.

export const JUMUIYA_LIST = [
  'MALAWI A',
  'MALAWI B',
  'KANISANI A',
  'KANISANI B',
  'KIWALANI BOM BOM',
  'KIWALANI KIGILA GILA',
  'RELINI YERIKO',
  'RELINI GALILAYA',
  'RELINI JERUSALEM',
  'MINAZI MIREFU KATI',
  'MINAZI MIREFU BOM BOM',
  'MINAZI MIREFU HALI YA HEWA',
  'MINAZI MIREFU MIGOMBANI',
] as const;

export type Jumuiya = (typeof JUMUIYA_LIST)[number];