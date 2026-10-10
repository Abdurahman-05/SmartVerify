/**
 * Sample Ethiopian restaurant menu that owners can import instead of typing everything.
 * Data only. NO alcoholic drinks (a test enforces this).
 *
 * suggestedPriceEtb values are only suggestions (mid-range Addis Ababa prices, integer ETB):
 * the owner edits them while importing or later. `key` is a stable slug — never rename one,
 * because imported menu items keep it in MenuItem.catalogKey.
 * Items are listed in display order inside each group.
 */

export type CatalogCategory = 'food' | 'drinks' | 'combos';

export const catalogGroups = {
  food: ['breakfast', 'meat', 'fasting', 'fastFood', 'fish'],
  drinks: ['hotDrinks', 'softDrinks', 'juice', 'water'],
  combos: ['combos'],
} as const;

export type CatalogGroup = (typeof catalogGroups)[CatalogCategory][number];

export interface CatalogItem {
  key: string;
  name: string;
  nameAm: string;
  category: CatalogCategory;
  /** A code; the app translates it (Breakfast, Meat, Fasting, Fast food, Fish, Hot drinks, …). */
  group: CatalogGroup;
  suggestedPriceEtb: number;
}

export const CATALOG: readonly CatalogItem[] = [
  // ─── Food · Breakfast ────────────────────────────────────────────────────
  {
    key: 'special-firfir',
    name: 'Special Firfir',
    nameAm: 'ስፔሻል ፍርፍር',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 280,
  },
  {
    key: 'firfir',
    name: 'Firfir',
    nameAm: 'ፍርፍር',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 180,
  },
  {
    key: 'enkulal-firfir',
    name: 'Enkulal Firfir',
    nameAm: 'እንቁላል ፍርፍር',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 170,
  },
  {
    key: 'genfo',
    name: 'Genfo',
    nameAm: 'ገንፎ',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 200,
  },
  {
    key: 'chechebsa',
    name: 'Chechebsa',
    nameAm: 'ጨጨብሳ',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 180,
  },
  {
    key: 'ful',
    name: 'Ful',
    nameAm: 'ፉል',
    category: 'food',
    group: 'breakfast',
    suggestedPriceEtb: 150,
  },

  // ─── Food · Meat ─────────────────────────────────────────────────────────
  {
    key: 'doro-wat',
    name: 'Doro Wat',
    nameAm: 'ዶሮ ወጥ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 450,
  },
  {
    key: 'kitfo',
    name: 'Kitfo',
    nameAm: 'ክትፎ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 550,
  },
  {
    key: 'gored-gored',
    name: 'Gored Gored',
    nameAm: 'ጎረድ ጎረድ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 500,
  },
  {
    key: 'tibs',
    name: 'Tibs',
    nameAm: 'ጥብስ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 400,
  },
  {
    key: 'special-tibs',
    name: 'Special Tibs',
    nameAm: 'ስፔሻል ጥብስ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 480,
  },
  {
    key: 'shekla-tibs',
    name: 'Shekla Tibs',
    nameAm: 'ሸክላ ጥብስ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 520,
  },
  {
    key: 'dulet',
    name: 'Dulet',
    nameAm: 'ዱለት',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 350,
  },
  {
    key: 'beyaynetu',
    name: 'Beyaynetu',
    nameAm: 'በያይነቱ',
    category: 'food',
    group: 'meat',
    suggestedPriceEtb: 350,
  },

  // ─── Food · Fasting ──────────────────────────────────────────────────────
  {
    key: 'shiro',
    name: 'Shiro',
    nameAm: 'ሽሮ',
    category: 'food',
    group: 'fasting',
    suggestedPriceEtb: 150,
  },
  {
    key: 'shiro-tegabino',
    name: 'Shiro Tegabino',
    nameAm: 'ሽሮ ተጋቢኖ',
    category: 'food',
    group: 'fasting',
    suggestedPriceEtb: 180,
  },
  {
    key: 'misir-wat',
    name: 'Misir Wat',
    nameAm: 'ምስር ወጥ',
    category: 'food',
    group: 'fasting',
    suggestedPriceEtb: 160,
  },
  {
    key: 'atkilt-wat',
    name: 'Atkilt Wat',
    nameAm: 'አትክልት ወጥ',
    category: 'food',
    group: 'fasting',
    suggestedPriceEtb: 140,
  },
  {
    key: 'yetsom-beyaynetu',
    name: 'Fasting Platter (Yetsom Beyaynetu)',
    nameAm: 'የጾም በያይነቱ',
    category: 'food',
    group: 'fasting',
    suggestedPriceEtb: 250,
  },

  // ─── Food · Fast food ────────────────────────────────────────────────────
  {
    key: 'pasta',
    name: 'Pasta',
    nameAm: 'ፓስታ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 220,
  },
  {
    key: 'spaghetti',
    name: 'Spaghetti',
    nameAm: 'ስፓጌቲ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 230,
  },
  {
    key: 'rice-with-sauce',
    name: 'Rice with Sauce',
    nameAm: 'ሩዝ በሶስ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 220,
  },
  {
    key: 'beef-burger',
    name: 'Beef Burger',
    nameAm: 'የበሬ በርገር',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 380,
  },
  {
    key: 'chicken-burger',
    name: 'Chicken Burger',
    nameAm: 'የዶሮ በርገር',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 360,
  },
  {
    key: 'club-sandwich',
    name: 'Club Sandwich',
    nameAm: 'ክለብ ሳንድዊች',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 350,
  },
  {
    key: 'pizza',
    name: 'Pizza',
    nameAm: 'ፒዛ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 550,
  },
  {
    key: 'fried-chicken',
    name: 'Fried Chicken',
    nameAm: 'የተጠበሰ ዶሮ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 480,
  },
  {
    key: 'chips',
    name: 'Chips',
    nameAm: 'ችፕስ',
    category: 'food',
    group: 'fastFood',
    suggestedPriceEtb: 150,
  },

  // ─── Food · Fish ─────────────────────────────────────────────────────────
  {
    key: 'fish-goulash',
    name: 'Fish Goulash',
    nameAm: 'የአሳ ጉላሽ',
    category: 'food',
    group: 'fish',
    suggestedPriceEtb: 420,
  },
  {
    key: 'grilled-fish',
    name: 'Grilled Fish',
    nameAm: 'አሳ ጥብስ',
    category: 'food',
    group: 'fish',
    suggestedPriceEtb: 480,
  },

  // ─── Drinks · Hot drinks ─────────────────────────────────────────────────
  {
    key: 'macchiato',
    name: 'Macchiato',
    nameAm: 'ማኪያቶ',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 60,
  },
  {
    key: 'coffee',
    name: 'Coffee',
    nameAm: 'ቡና',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 40,
  },
  {
    key: 'black-coffee',
    name: 'Black Coffee',
    nameAm: 'ጥቁር ቡና',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 40,
  },
  {
    key: 'tea',
    name: 'Tea',
    nameAm: 'ሻይ',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 30,
  },
  {
    key: 'spiced-tea',
    name: 'Spiced Tea',
    nameAm: 'ቅመም ሻይ',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 35,
  },
  {
    key: 'milk-tea',
    name: 'Milk Tea',
    nameAm: 'ወተት በሻይ',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 45,
  },
  {
    key: 'hot-milk',
    name: 'Hot Milk',
    nameAm: 'ትኩስ ወተት',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 50,
  },
  // Spris: coffee and tea poured together.
  {
    key: 'spris',
    name: 'Spris',
    nameAm: 'ስፕሪስ',
    category: 'drinks',
    group: 'hotDrinks',
    suggestedPriceEtb: 50,
  },

  // ─── Drinks · Juice ──────────────────────────────────────────────────────
  // Spris Juice: layered fresh fruit juice.
  {
    key: 'spris-juice',
    name: 'Spris Juice',
    nameAm: 'ስፕሪስ ጭማቂ',
    category: 'drinks',
    group: 'juice',
    suggestedPriceEtb: 130,
  },
  {
    key: 'avocado-juice',
    name: 'Avocado Juice',
    nameAm: 'የአቮካዶ ጭማቂ',
    category: 'drinks',
    group: 'juice',
    suggestedPriceEtb: 120,
  },
  {
    key: 'mango-juice',
    name: 'Mango Juice',
    nameAm: 'የማንጎ ጭማቂ',
    category: 'drinks',
    group: 'juice',
    suggestedPriceEtb: 120,
  },
  {
    key: 'papaya-juice',
    name: 'Papaya Juice',
    nameAm: 'የፓፓያ ጭማቂ',
    category: 'drinks',
    group: 'juice',
    suggestedPriceEtb: 110,
  },
  {
    key: 'orange-juice',
    name: 'Orange Juice',
    nameAm: 'የብርቱካን ጭማቂ',
    category: 'drinks',
    group: 'juice',
    suggestedPriceEtb: 130,
  },

  // ─── Drinks · Water ──────────────────────────────────────────────────────
  {
    key: 'ambo-mineral-water',
    name: 'Mineral Water (Ambo)',
    nameAm: 'አምቦ ውሃ',
    category: 'drinks',
    group: 'water',
    suggestedPriceEtb: 50,
  },
  {
    key: 'water-small',
    name: 'Water (small)',
    nameAm: 'ውሃ (ትንሽ)',
    category: 'drinks',
    group: 'water',
    suggestedPriceEtb: 30,
  },
  {
    key: 'sparkling-water',
    name: 'Sparkling Water',
    nameAm: 'ጋዝ ያለው ውሃ',
    category: 'drinks',
    group: 'water',
    suggestedPriceEtb: 45,
  },

  // ─── Drinks · Soft drinks ────────────────────────────────────────────────
  {
    key: 'coca-cola',
    name: 'Coca-Cola',
    nameAm: 'ኮካ ኮላ',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 50,
  },
  {
    key: 'pepsi',
    name: 'Pepsi',
    nameAm: 'ፔፕሲ',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 50,
  },
  {
    key: 'fanta',
    name: 'Fanta',
    nameAm: 'ፋንታ',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 50,
  },
  {
    key: 'sprite',
    name: 'Sprite',
    nameAm: 'ስፕራይት',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 50,
  },
  {
    key: 'mirinda',
    name: 'Mirinda',
    nameAm: 'ሚሪንዳ',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 50,
  },
  {
    key: 'energy-drink',
    name: 'Energy Drink',
    nameAm: 'ኢነርጂ መጠጥ',
    category: 'drinks',
    group: 'softDrinks',
    suggestedPriceEtb: 120,
  },

  // ─── Combos ──────────────────────────────────────────────────────────────
  {
    key: 'breakfast-combo',
    name: 'Breakfast Combo',
    nameAm: 'የቁርስ ጥምር',
    category: 'combos',
    group: 'combos',
    suggestedPriceEtb: 350,
  },
  {
    key: 'lunch-combo',
    name: 'Lunch Combo',
    nameAm: 'የምሳ ጥምር',
    category: 'combos',
    group: 'combos',
    suggestedPriceEtb: 450,
  },
  {
    key: 'family-platter',
    name: 'Family Platter',
    nameAm: 'የቤተሰብ ትሪ',
    category: 'combos',
    group: 'combos',
    suggestedPriceEtb: 1500,
  },
  {
    key: 'fasting-combo',
    name: 'Fasting Combo',
    nameAm: 'የጾም ጥምር',
    category: 'combos',
    group: 'combos',
    suggestedPriceEtb: 300,
  },
  {
    key: 'burger-chips-drink',
    name: 'Burger + Chips + Drink',
    nameAm: 'በርገር + ችፕስ + መጠጥ',
    category: 'combos',
    group: 'combos',
    suggestedPriceEtb: 520,
  },
];

export const catalogByKey = new Map(CATALOG.map((item) => [item.key, item]));
