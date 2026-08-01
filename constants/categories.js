// Categories and the lookup rules that classify an expense WITHOUT an AI call.
//
// The brief is explicit: known tiles and recognisable words are categorized by
// simple rules; AI is reserved for language parsing, receipts, summaries and
// Q&A. So the flow is:
//   1. Expense came from a tile  → use the tile's category. Done, no matching.
//   2. Free text ("40 rickshaw") → Gemini splits it into {label, amount} pairs,
//      then `matchCategory` below assigns the category from the label. Gemini
//      is never asked "which category is this".
//   3. No keyword hit           → 'other', flagged so the UI can offer a pick.
//
// Colors are the design tokens from Tally.dc.html's "Where it went" breakdown.

export const CATEGORY_SLUGS = {
  FOOD: 'food-drink',
  CIGARETTES: 'cigarettes',
  TRANSPORT: 'transport',
  BILLS: 'bills-data',
  GROCERIES: 'groceries',
  HEALTH: 'health',
  SHOPPING: 'shopping',
  OTHER: 'other',
};

/**
 * Seeded for every new account. `keywords` drive `matchCategory`; users can
 * add their own to a category later, which is why these live on the document
 * rather than in code at match time.
 */
export const DEFAULT_CATEGORIES = [
  {
    slug: CATEGORY_SLUGS.FOOD,
    name: 'Food & drink',
    colorToken: 'var(--blue)',
    colorHex: '#1B4DFF',
    iconKey: 'lunch',
    isSystem: true,
    sortIndex: 0,
    keywords: [
      'tea', 'cha', 'chai', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack',
      'biryani', 'kacchi', 'burger', 'pizza', 'restaurant', 'cafe', 'canteen',
      'delivery', 'foodpanda', 'pathao food', 'hotel', 'juice', 'drink',
      'water', 'cake', 'dessert', 'iftar', 'meal', 'food',
    ],
  },
  {
    slug: CATEGORY_SLUGS.CIGARETTES,
    name: 'Cigarettes',
    colorToken: 'var(--amber)',
    colorHex: '#F5A524',
    iconKey: 'cig',
    isSystem: true,
    sortIndex: 1,
    keywords: ['cigarette', 'cig', 'smoke', 'benson', 'gold leaf', 'marlboro', 'pack'],
  },
  {
    slug: CATEGORY_SLUGS.TRANSPORT,
    name: 'Transport',
    colorToken: '#5E7FFF',
    colorHex: '#5E7FFF',
    iconKey: 'rick',
    isSystem: true,
    sortIndex: 2,
    keywords: [
      'rickshaw', 'riksha', 'cng', 'uber', 'pathao', 'bus', 'train', 'launch',
      'ride', 'fare', 'taxi', 'ticket', 'metro', 'auto', 'transport', 'toll',
      'parking',
    ],
  },
  {
    slug: CATEGORY_SLUGS.BILLS,
    name: 'Bills & data',
    colorToken: '#AFC2FF',
    colorHex: '#AFC2FF',
    iconKey: 'data',
    isSystem: true,
    sortIndex: 3,
    keywords: [
      'data', 'recharge', 'internet', 'wifi', 'broadband', 'electricity',
      'gas bill', 'water bill', 'rent', 'bill', 'subscription', 'netflix',
      'spotify', 'mobile', 'flexiload', 'top up', 'topup',
    ],
  },
  {
    slug: CATEGORY_SLUGS.GROCERIES,
    name: 'Groceries',
    colorToken: '#0FA47F',
    colorHex: '#0FA47F',
    iconKey: 'grocery',
    isSystem: true,
    sortIndex: 4,
    keywords: [
      'grocery', 'groceries', 'bazar', 'bazaar', 'market', 'vegetable', 'rice',
      'fish', 'meat', 'egg', 'milk', 'oil', 'shwapno', 'agora', 'meena bazar',
    ],
  },
  {
    slug: CATEGORY_SLUGS.HEALTH,
    name: 'Health',
    colorToken: '#2BC49B',
    colorHex: '#2BC49B',
    iconKey: 'medicine',
    isSystem: true,
    sortIndex: 5,
    keywords: [
      'medicine', 'pharmacy', 'doctor', 'hospital', 'clinic', 'test', 'dental',
      'checkup', 'lab', 'health',
    ],
  },
  {
    slug: CATEGORY_SLUGS.SHOPPING,
    name: 'Shopping',
    colorToken: '#8B5CF6',
    colorHex: '#8B5CF6',
    iconKey: 'bag',
    isSystem: true,
    sortIndex: 6,
    keywords: [
      'shirt', 'pant', 'shoe', 'clothes', 'dress', 'daraz', 'amazon', 'gift',
      'salon', 'haircut', 'shopping',
    ],
  },
  {
    slug: CATEGORY_SLUGS.OTHER,
    name: 'Other',
    colorToken: 'var(--line)',
    colorHex: '#E4E7EC',
    iconKey: 'bag',
    isSystem: true,
    sortIndex: 7,
    keywords: [],
  },
];

/**
 * Match a free-text label to a category slug using the supplied keyword table.
 *
 * Longest keyword wins, so "gas bill" beats a bare "gas" and "pathao food"
 * beats "pathao". Matching is word-boundary aware — "cha" must not fire on
 * "charger" — while still allowing multi-word keywords.
 *
 * @param {string} label            free text, e.g. "40 rickshaw to office"
 * @param {Array}  categories       documents with { slug, keywords }
 * @returns {{ slug: string, keyword: string|null, matched: boolean }}
 */
export const matchCategory = (label, categories = DEFAULT_CATEGORIES) => {
  const text = String(label ?? '').toLowerCase().trim();
  if (!text) return { slug: CATEGORY_SLUGS.OTHER, keyword: null, matched: false };

  let best = { slug: CATEGORY_SLUGS.OTHER, keyword: null, matched: false };

  for (const category of categories) {
    for (const keyword of category.keywords ?? []) {
      const k = String(keyword).toLowerCase();
      if (!k) continue;

      // Escape regex metacharacters, then require word boundaries so short
      // keywords don't match inside longer words.
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');

      if (pattern.test(text) && k.length > (best.keyword?.length ?? 0)) {
        best = { slug: category.slug, keyword: k, matched: true };
      }
    }
  }

  return best;
};
