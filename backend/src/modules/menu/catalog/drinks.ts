import { item, type CatalogPack } from './types.js';

/** Non-alcoholic drinks only. */
export const drinks: CatalogPack = {
  key: 'drinks',
  name: 'Drinks',
  nameAm: 'መጠጦች',
  groups: [
    {
      key: 'soft-drinks',
      name: 'Soft Drinks',
      nameAm: 'ለስላሳ መጠጦች',
      category: 'drinks',
      items: [
        item('coca-cola', 'Coca-Cola', 'ኮካ ኮላ', 50),
        item('pepsi', 'Pepsi', 'ፔፕሲ', 50),
        item('fanta', 'Fanta', 'ፋንታ', 50),
        item('sprite', 'Sprite', 'ስፕራይት', 50),
        item('mirinda', 'Mirinda', 'ሚሪንዳ', 50),
        item('energy-drink', 'Energy Drink', 'ኢነርጂ መጠጥ', 120),
      ],
    },
    {
      key: 'juice',
      name: 'Juice',
      nameAm: 'ጭማቂ',
      category: 'drinks',
      items: [
        item('avocado-juice', 'Avocado Juice', 'የአቮካዶ ጭማቂ', 120),
        item('mango-juice', 'Mango Juice', 'የማንጎ ጭማቂ', 120),
        item('papaya-juice', 'Papaya Juice', 'የፓፓያ ጭማቂ', 110),
        item('orange-juice', 'Orange Juice', 'የብርቱካን ጭማቂ', 130),
        item('mixed-fruit-juice', 'Mixed Fruit Juice', 'የተቀላቀለ ፍራፍሬ ጭማቂ', 140),
        // Spris: layered fresh fruit juice.
        item('spris-juice', 'Spris Juice', 'ስፕሪስ ጭማቂ', 130),
        item('lemonade', 'Lemonade', 'ሎሚናት', 80),
      ],
    },
    {
      key: 'water',
      name: 'Water',
      nameAm: 'ውሃ',
      category: 'drinks',
      items: [
        item('ambo-sparkling-water', 'Ambo Sparkling Water', 'አምቦ ውሃ', 50),
        item('mineral-water', 'Mineral Water', 'የታሸገ ውሃ', 40),
        item('water-small', 'Water (small)', 'ውሃ (ትንሽ)', 30),
        item('water-large', 'Water (large)', 'ውሃ (ትልቅ)', 50),
      ],
    },
    {
      key: 'milkshakes',
      name: 'Milkshakes',
      nameAm: 'ሚልክሼክ',
      category: 'drinks',
      items: [
        item('vanilla-milkshake', 'Vanilla Milkshake', 'የቫኒላ ሚልክሼክ', 150),
        item('chocolate-milkshake', 'Chocolate Milkshake', 'የቸኮሌት ሚልክሼክ', 160),
        item('strawberry-milkshake', 'Strawberry Milkshake', 'የእንጆሪ ሚልክሼክ', 160),
        item('banana-milkshake', 'Banana Milkshake', 'የሙዝ ሚልክሼክ', 150),
      ],
    },
  ],
};
