import { item, type CatalogPack } from './types.js';

export const arabMandi: CatalogPack = {
  key: 'arab-mandi',
  name: 'Arab & Mandi',
  nameAm: 'የዓረብ ምግብ እና መንዲ',
  groups: [
    {
      key: 'mandi-kabsa',
      name: 'Mandi & Kabsa',
      nameAm: 'መንዲ እና ከብሳ',
      category: 'food',
      items: [
        item('chicken-mandi', 'Chicken Mandi', 'የዶሮ መንዲ', 650),
        item('lamb-mandi', 'Lamb Mandi', 'የበግ መንዲ', 900),
        item('beef-mandi', 'Beef Mandi', 'የበሬ መንዲ', 800),
        item('fish-mandi', 'Fish Mandi', 'የአሳ መንዲ', 750),
        item('chicken-kabsa', 'Chicken Kabsa', 'የዶሮ ከብሳ', 600),
        item('lamb-kabsa', 'Lamb Kabsa', 'የበግ ከብሳ', 850),
        item('lamb-haneeth', 'Lamb Haneeth', 'የበግ ሀኒዝ', 950),
        item('chicken-haneeth', 'Chicken Haneeth', 'የዶሮ ሀኒዝ', 700),
        item('arabic-rice', 'Arabic Rice', 'የዓረብ ሩዝ', 200),
      ],
    },
    {
      key: 'grill-wraps',
      name: 'Grill & Wraps',
      nameAm: 'ጥብስ እና ራፕ',
      category: 'food',
      items: [
        item('mixed-grill', 'Mixed Grill', 'ሚክስድ ግሪል', 850),
        item('chicken-kebab', 'Chicken Kebab', 'የዶሮ ከባብ', 500),
        item('beef-kebab', 'Beef Kebab', 'የበሬ ከባብ', 550),
        item('chicken-shawarma', 'Chicken Shawarma', 'የዶሮ ሻዋርማ', 300),
        item('beef-shawarma', 'Beef Shawarma', 'የበሬ ሻዋርማ', 350),
        item('chicken-shish-tawook', 'Chicken Shish Tawook', 'የዶሮ ሺሽ ጣውቅ', 500),
        item('falafel-wrap', 'Falafel Wrap', 'ፈላፍል ራፕ', 220),
      ],
    },
    {
      key: 'starters-soups',
      name: 'Starters & Soups',
      nameAm: 'መጀመሪያ እና ሾርባ',
      category: 'food',
      items: [
        item('hummus', 'Hummus', 'ሁሙስ', 200),
        item('mutabbal', 'Mutabbal', 'ሙተበል', 200),
        item('fattoush-salad', 'Fattoush Salad', 'ፈቱሽ ሰላጣ', 220),
        item('tabbouleh', 'Tabbouleh', 'ተቡሌ', 220),
        item('falafel', 'Falafel', 'ፈላፍል', 180),
        // "Arabic" keeps the name distinct from the Everyday pack's Lentil Soup.
        item('arabic-lentil-soup', 'Arabic Lentil Soup', 'የዓረብ የምስር ሾርባ', 180),
        item('arabic-bread', 'Arabic Bread', 'የዓረብ ዳቦ', 50),
      ],
    },
    {
      key: 'desserts',
      name: 'Desserts',
      nameAm: 'ጣፋጭ',
      category: 'food',
      items: [
        item('kunafa', 'Kunafa', 'ኩናፋ', 350),
        item('basbousa', 'Basbousa', 'በስቡሳ', 200),
        item('baklava', 'Baklava', 'ባቅላቫ', 250),
        item('umm-ali', 'Umm Ali', 'ኡም ዓሊ', 300),
      ],
    },
    {
      key: 'arab-drinks',
      name: 'Arab Drinks',
      nameAm: 'የዓረብ መጠጦች',
      category: 'drinks',
      items: [
        item('qahwa', 'Arabic Coffee (Qahwa)', 'የዓረብ ቡና (ቃህዋ)', 80),
        item('mint-tea', 'Mint Tea', 'የናና ሻይ', 50),
        item('karak-tea', 'Karak Tea', 'ካራክ ሻይ', 70),
        item('laban', 'Laban', 'ላባን', 90),
        item('lemon-mint', 'Lemon with Mint', 'ሎሚ በናና', 100),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('mandi-family-tray', 'Mandi Family Tray', 'የመንዲ የቤተሰብ ትሪ', 2500),
        item('mandi-for-2', 'Mandi for 2', 'መንዲ ለሁለት', 1200),
        item('mixed-grill-platter', 'Mixed Grill Platter', 'ሚክስድ ግሪል ትሪ', 1600),
      ],
    },
  ],
};
