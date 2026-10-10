import { item, type CatalogPack } from './types.js';

export const ethiopianEveryday: CatalogPack = {
  key: 'ethiopian-everyday',
  name: 'Ethiopian Everyday',
  nameAm: 'የዕለት ተዕለት ምግብ',
  groups: [
    {
      key: 'everyday-dishes',
      name: 'Everyday Dishes',
      nameAm: 'የዕለት ምግቦች',
      category: 'food',
      items: [
        item('shiro-tegabino', 'Shiro Tegabino', 'ሽሮ ተጋቢኖ', 180),
        item('shiro', 'Shiro', 'ሽሮ', 150),
        item('misir-wat', 'Misir Wat', 'ምስር ወጥ', 160),
        item('atkilt-wat', 'Atkilt Wat', 'አትክልት ወጥ', 140),
        item('gomen-besiga', 'Gomen Besiga', 'ጎመን በሥጋ', 300),
        item('fish-goulash', 'Fish Goulash', 'የአሳ ጉላሽ', 420),
        item('fish-cutlet', 'Fish Cutlet', 'የአሳ ኮተሌት', 400),
        item('fried-fish', 'Fried Fish', 'አሳ ጥብስ', 450),
        item('egg-firfir', 'Egg Firfir', 'እንቁላል በፍርፍር', 170),
        item('scrambled-eggs', 'Scrambled Eggs', 'የተመታ እንቁላል', 150),
        item('omelette', 'Omelette', 'ኦምሌት', 160),
        item('ful', 'Ful', 'ፉል', 150),
        item('ful-special', 'Ful Special', 'ስፔሻል ፉል', 220),
        item('egg-sandwich', 'Egg Sandwich', 'የእንቁላል ሳንድዊች', 180),
      ],
    },
    {
      key: 'pasta-rice',
      name: 'Pasta & Rice',
      nameAm: 'ፓስታ እና ሩዝ',
      category: 'food',
      items: [
        item('spaghetti-sauce', 'Spaghetti with Sauce', 'ስፓጌቲ በሶስ', 200),
        item('spaghetti-meat', 'Spaghetti with Meat', 'ስፓጌቲ በሥጋ', 280),
        item('macaroni', 'Macaroni', 'መኮሮኒ', 200),
        item('rice-sauce', 'Rice with Sauce', 'ሩዝ በሶስ', 200),
        item('rice-chicken', 'Rice with Chicken', 'ሩዝ በዶሮ', 320),
        item('rice-meat', 'Rice with Meat', 'ሩዝ በሥጋ', 300),
      ],
    },
    {
      key: 'soups',
      name: 'Soups',
      nameAm: 'ሾርባ',
      category: 'food',
      items: [
        item('beef-soup', 'Beef Soup', 'የሥጋ ሾርባ', 200),
        item('chicken-soup', 'Chicken Soup', 'የዶሮ ሾርባ', 200),
        item('lentil-soup', 'Lentil Soup', 'የምስር ሾርባ', 150),
        item('vegetable-soup', 'Vegetable Soup', 'የአትክልት ሾርባ', 150),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('breakfast-combo', 'Breakfast Combo', 'የቁርስ ጥምር', 300),
        item('lunch-combo', 'Lunch Combo', 'የምሳ ጥምር', 400),
        item('student-combo', 'Student Combo', 'የተማሪ ጥምር', 250),
      ],
    },
  ],
};
