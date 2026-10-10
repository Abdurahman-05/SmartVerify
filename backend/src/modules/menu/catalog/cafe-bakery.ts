import { item, type CatalogPack } from './types.js';

export const cafeBakery: CatalogPack = {
  key: 'cafe-bakery',
  name: 'Cafe & Bakery',
  nameAm: 'ካፌ እና ዳቦ ቤት',
  groups: [
    {
      key: 'hot-drinks',
      name: 'Hot Drinks',
      nameAm: 'ትኩስ መጠጦች',
      category: 'drinks',
      items: [
        item('macchiato', 'Macchiato', 'ማኪያቶ', 60),
        item('coffee', 'Coffee', 'ቡና', 40),
        item('black-coffee', 'Black Coffee', 'ጥቁር ቡና', 40),
        item('cappuccino', 'Cappuccino', 'ካፑቺኖ', 90),
        item('latte', 'Latte', 'ላቴ', 90),
        item('tea', 'Tea', 'ሻይ', 30),
        item('spiced-tea', 'Spiced Tea', 'ቅመም ሻይ', 35),
        item('milk-tea', 'Milk Tea', 'ወተት በሻይ', 45),
        item('hot-milk', 'Hot Milk', 'ትኩስ ወተት', 50),
        item('hot-chocolate', 'Hot Chocolate', 'ትኩስ ቸኮሌት', 100),
      ],
    },
    {
      key: 'bakery-pastry',
      name: 'Bakery & Pastry',
      nameAm: 'ዳቦ እና ኬክ',
      category: 'food',
      items: [
        item('sambusa', 'Sambusa', 'ሳምቡሳ', 40),
        item('croissant', 'Croissant', 'ክሮሳንት', 80),
        item('donut', 'Donut', 'ዶናት', 50),
        item('cake-slice', 'Cake Slice', 'ኬክ (ቁራጭ)', 120),
        item('chocolate-cake', 'Chocolate Cake', 'የቸኮሌት ኬክ', 150),
        item('cookies', 'Cookies', 'ኩኪስ', 60),
        item('bread-butter', 'Bread with Butter', 'ዳቦ በቅቤ', 60),
        item('pancake', 'Pancake', 'ፓንኬክ', 150),
        item('french-toast', 'French Toast', 'ፍሬንች ቶስት', 160),
      ],
    },
    {
      key: 'breakfast',
      name: 'Breakfast',
      nameAm: 'ቁርስ',
      category: 'food',
      items: [
        item('bread-egg', 'Bread with Egg', 'ዳቦ በእንቁላል', 120),
        item('omelette-sandwich', 'Omelette Sandwich', 'የኦምሌት ሳንድዊች', 180),
        item('ful-bread', 'Ful with Bread', 'ፉል በዳቦ', 160),
        item('fruit-salad', 'Fruit Salad', 'የፍራፍሬ ሰላጣ', 150),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('coffee-sambusa', 'Coffee + Sambusa', 'ቡና + ሳምቡሳ', 75),
        item('breakfast-set', 'Breakfast Set', 'የቁርስ ሴት', 250),
      ],
    },
  ],
};
