import { item, type CatalogPack } from './types.js';

export const ethiopianFasting: CatalogPack = {
  key: 'ethiopian-fasting',
  name: 'Ethiopian Fasting',
  nameAm: 'የጾም ምግብ',
  groups: [
    {
      key: 'fasting-food',
      name: 'Fasting Food',
      nameAm: 'የጾም ምግቦች',
      category: 'food',
      items: [
        item('yetsom-beyaynetu', 'Yetsom Beyaynetu', 'የጾም በያይነቱ', 250),
        item('shiro-fasting', 'Shiro Fasting', 'የጾም ሽሮ', 150),
        item('misir-wat-fasting', 'Misir Wat Fasting', 'የጾም ምስር ወጥ', 160),
        item('atkilt-wat-fasting', 'Atkilt Wat Fasting', 'የጾም አትክልት ወጥ', 140),
        item('gomen', 'Gomen', 'ጎመን', 130),
        item('kik-alicha', 'Kik Alicha', 'ክክ አልጫ', 140),
        item('dinich-wat', 'Dinich Wat', 'ድንች ወጥ', 140),
        item('tikil-gomen', 'Tikil Gomen', 'ጥቅል ጎመን', 130),
        item('fasting-firfir', 'Fasting Firfir', 'የጾም ፍርፍር', 160),
        item('fasting-pasta', 'Fasting Pasta', 'የጾም ፓስታ', 180),
        item('fasting-genfo', 'Fasting Genfo', 'የጾም ገንፎ', 180),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('fasting-platter-2', 'Fasting Platter for 2', 'የጾም ትሪ ለሁለት', 450),
        item('fasting-family-platter', 'Fasting Family Platter', 'የጾም የቤተሰብ ትሪ', 900),
      ],
    },
  ],
};
