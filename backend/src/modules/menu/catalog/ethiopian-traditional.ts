import { item, type CatalogPack } from './types.js';

export const ethiopianTraditional: CatalogPack = {
  key: 'ethiopian-traditional',
  name: 'Ethiopian Traditional',
  nameAm: 'የኢትዮጵያ ባህላዊ',
  groups: [
    {
      key: 'meat-tibs',
      name: 'Meat & Tibs',
      nameAm: 'ሥጋ እና ጥብስ',
      category: 'food',
      items: [
        item('doro-wat', 'Doro Wat', 'ዶሮ ወጥ', 450),
        item('special-doro-wat', 'Special Doro Wat', 'ስፔሻል ዶሮ ወጥ', 600),
        item('siga-wat', 'Siga Wat', 'ሥጋ ወጥ', 380),
        item('tibs', 'Tibs', 'ጥብስ', 400),
        item('special-tibs', 'Special Tibs', 'ስፔሻል ጥብስ', 480),
        item('shekla-tibs', 'Shekla Tibs', 'ሸክላ ጥብስ', 520),
        item('yebeg-tibs', 'Yebeg Tibs', 'የበግ ጥብስ', 500),
        item('derek-tibs', 'Derek Tibs', 'ደረቅ ጥብስ', 450),
        item('awaze-tibs', 'Awaze Tibs', 'አዋዜ ጥብስ', 450),
      ],
    },
    {
      key: 'raw-kitfo',
      name: 'Raw & Kitfo',
      nameAm: 'ጥሬ እና ክትፎ',
      category: 'food',
      items: [
        item('kitfo', 'Kitfo', 'ክትፎ', 550),
        item('kitfo-leb-leb', 'Kitfo Leb Leb', 'ክትፎ ለብ ለብ', 550),
        item('special-kitfo', 'Special Kitfo', 'ስፔሻል ክትፎ', 700),
        item('gored-gored', 'Gored Gored', 'ጎረድ ጎረድ', 500),
        item('tere-siga', 'Tere Siga', 'ጥሬ ሥጋ', 600),
        item('dulet', 'Dulet', 'ዱለት', 350),
        item('kitfo-ayib-gomen', 'Kitfo with Ayib and Gomen', 'ክትፎ በአይብና በጎመን', 650),
      ],
    },
    {
      key: 'breakfast-staples',
      name: 'Traditional Breakfast & Staples',
      nameAm: 'ባህላዊ ቁርስ',
      category: 'food',
      items: [
        item('special-firfir', 'Special Firfir', 'ስፔሻል ፍርፍር', 280),
        item('firfir', 'Firfir', 'ፍርፍር', 180),
        item('enkulal-firfir', 'Enkulal Firfir', 'እንቁላል ፍርፍር', 170),
        item('chechebsa', 'Chechebsa', 'ጨጨብሳ', 180),
        item('genfo', 'Genfo', 'ገንፎ', 200),
        item('kinche', 'Kinche', 'ቅንጬ', 150),
        item('fetira', 'Fetira', 'ፈጢራ', 220),
        item('dabo-kolo', 'Dabo Kolo', 'ዳቦ ቆሎ', 80),
      ],
    },
    {
      key: 'platters',
      name: 'Platters',
      nameAm: 'በያይነቱ',
      category: 'food',
      items: [
        item('meat-beyaynetu', 'Meat Beyaynetu', 'የሥጋ በያይነቱ', 400),
        item('mixed-platter', 'Mixed Platter', 'ድብልቅ ትሪ', 600),
        item('special-platter', 'Special Platter', 'ስፔሻል ትሪ', 900),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('family-meat-platter', 'Family Meat Platter', 'የቤተሰብ ሥጋ ትሪ', 1800),
        item('special-kitfo-combo', 'Special Kitfo Combo', 'ስፔሻል ክትፎ ጥምር', 950),
        item('doro-wat-injera-combo', 'Doro Wat + Injera Combo', 'ዶሮ ወጥ + እንጀራ ጥምር', 550),
      ],
    },
  ],
};
