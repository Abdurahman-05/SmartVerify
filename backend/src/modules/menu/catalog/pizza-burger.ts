import { item, type CatalogPack } from './types.js';

export const pizzaBurger: CatalogPack = {
  key: 'pizza-burger',
  name: 'Pizza & Burger',
  nameAm: 'ፒዛ እና በርገር',
  groups: [
    {
      key: 'pizza',
      name: 'Pizza',
      nameAm: 'ፒዛ',
      category: 'food',
      items: [
        item('margherita-pizza', 'Margherita Pizza', 'ማርጋሪታ ፒዛ', 450),
        item('vegetable-pizza', 'Vegetable Pizza', 'የአትክልት ፒዛ', 480),
        item('chicken-pizza', 'Chicken Pizza', 'የዶሮ ፒዛ', 600),
        item('beef-pepperoni-pizza', 'Beef Pepperoni Pizza', 'የበሬ ፔፐሮኒ ፒዛ', 650),
        item('special-pizza', 'Special Pizza', 'ስፔሻል ፒዛ', 700),
        item('mixed-pizza', 'Mixed Pizza', 'ሚክስድ ፒዛ', 650),
      ],
    },
    {
      key: 'burgers-sandwiches',
      name: 'Burgers & Sandwiches',
      nameAm: 'በርገር እና ሳንድዊች',
      category: 'food',
      items: [
        item('beef-burger', 'Beef Burger', 'የበሬ በርገር', 380),
        item('cheese-burger', 'Cheese Burger', 'ቺዝ በርገር', 420),
        item('double-burger', 'Double Burger', 'ደብል በርገር', 550),
        item('chicken-burger', 'Chicken Burger', 'የዶሮ በርገር', 360),
        item('club-sandwich', 'Club Sandwich', 'ክለብ ሳንድዊች', 350),
        item('chicken-sandwich', 'Chicken Sandwich', 'የዶሮ ሳንድዊች', 300),
        item('tuna-sandwich', 'Tuna Sandwich', 'የቱና ሳንድዊች', 300),
        item('beef-hot-dog', 'Hot Dog (beef)', 'ሆት ዶግ (የበሬ)', 250),
      ],
    },
    {
      key: 'fried-sides',
      name: 'Fried & Sides',
      nameAm: 'ጥብስ እና ተጨማሪ',
      category: 'food',
      items: [
        item('french-fries', 'French Fries', 'ችፕስ', 150),
        item('fried-chicken', 'Fried Chicken', 'የተጠበሰ ዶሮ', 480),
        item('chicken-wings', 'Chicken Wings', 'የዶሮ ክንፍ', 400),
        item('chicken-nuggets', 'Chicken Nuggets', 'የዶሮ ናጌትስ', 350),
        item('onion-rings', 'Onion Rings', 'የሽንኩርት ቀለበት', 180),
        item('coleslaw', 'Coleslaw', 'ኮልስሎው', 120),
        item('garlic-bread', 'Garlic Bread', 'የነጭ ሽንኩርት ዳቦ', 120),
      ],
    },
    {
      key: 'pasta',
      name: 'Pasta',
      nameAm: 'ፓስታ',
      category: 'food',
      items: [
        item('spaghetti-bolognese', 'Spaghetti Bolognese', 'ስፓጌቲ ቦሎኔዝ', 320),
        item('chicken-alfredo', 'Chicken Alfredo', 'ቺክን አልፍሬዶ', 400),
        item('lasagna', 'Lasagna', 'ላዛኛ', 450),
      ],
    },
    {
      key: 'combos',
      name: 'Combos',
      nameAm: 'ጥምር',
      category: 'combos',
      items: [
        item('burger-chips-drink', 'Burger + Chips + Drink', 'በርገር + ችፕስ + መጠጥ', 520),
        item('pizza-drink-combo', 'Pizza + Drink Combo', 'ፒዛ + መጠጥ ጥምር', 600),
        item('family-pizza-combo', 'Family Pizza Combo', 'የቤተሰብ ፒዛ ጥምር', 1500),
        item('chicken-meal-combo', 'Chicken Meal Combo', 'የዶሮ ምግብ ጥምር', 650),
      ],
    },
  ],
};
