/** Terms of Service and Privacy Policy text (English and Amharic). Plain data, no logic. */

export type Lang = 'en' | 'am';
export type Kind = 'terms' | 'privacy';

export interface Contact {
  company: string;
  email: string;
  phone: string;
}

/** A heading with paragraphs; a paragraph starting with "- " lines is a bullet list. */
export interface Section {
  h: string;
  p: string[];
}

export const LAST_UPDATED: Record<Lang, string> = {
  en: '18 November 2026',
  am: 'ኅዳር 9 ቀን 2019 ዓ.ም.',
};

export const UI: Record<
  Lang,
  { app: string; updated: string; terms: string; privacy: string; other: string; lang: string }
> = {
  en: {
    app: 'ገብቷል (Gebtual / Smart Verify)',
    updated: 'Last updated',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    other: 'አማርኛ',
    lang: 'en',
  },
  am: {
    app: 'ገብቷል (Gebtual / Smart Verify)',
    updated: 'መጨረሻ የተሻሻለው',
    terms: 'የአገልግሎት ውል',
    privacy: 'የግላዊነት ፖሊሲ',
    other: 'English',
    lang: 'am',
  },
};

export function sections(kind: Kind, lang: Lang, c: Contact): Section[] {
  const key = `${kind}.${lang}` as const;
  switch (key) {
    case 'privacy.en':
      return [
        {
          h: 'About this policy',
          p: [
            `ገብቷል (Gebtual / Smart Verify) is a mobile app that helps Ethiopian restaurants and shops check bank and Telebirr payments and run orders, bills and reports. It is run by ${c.company}. This policy explains what we collect, why, and your choices.`,
          ],
        },
        {
          h: 'What we collect',
          p: [
            '- Owner and manager email address.',
            '- Staff names and phone numbers.',
            '- PINs. We store only a hashed form, never the PIN itself.',
            '- Business name and location (address and GPS point).',
            '- Orders, bills and tips, and expenses and purchases you record.',
            '- Bank account names and numbers you add so payments can be checked.',
            '- Payment references and receipt photos you submit for checking.',
            '- Your device push token, so we can send notifications.',
            '- Basic logs (for example errors and response times).',
          ],
        },
        {
          h: 'Why we use it',
          p: [
            '- To verify payments.',
            '- To run orders and reports for your business.',
            '- To send notifications.',
            '- For subscription billing.',
            '- For support.',
          ],
        },
        {
          h: 'Permissions the app asks for',
          p: [
            '- Location: to set your business location. Optional.',
            '- Camera and photos: to read payment receipts.',
            '- Notifications: to tell you about payments and orders.',
          ],
        },
        {
          h: 'Who we share it with',
          p: [
            'Only with service providers needed to run the app: hosting, email, maps, and bank or Telebirr verification. We never sell your data.',
          ],
        },
        {
          h: 'Support chat on Telegram',
          p: [
            'If you write to our support bot on Telegram, our support team reads your messages, your Telegram name and username, and any pictures you send, only to answer you. Telegram handles these chats under its own privacy policy, and they are not end-to-end encrypted. Never send your PIN or password in a support chat. Receipt pictures can show account numbers, so send them only when we ask.',
          ],
        },
        {
          h: 'How long we keep it, and deleting your data',
          p: [
            'We keep your data while your account is active. To delete your account and data, email us at the address below from your account email. We delete it within 30 days.',
          ],
        },
        {
          h: 'Security',
          p: [
            'Data is sent over HTTPS, PINs are hashed, and access is limited to people who need it. No system is perfectly secure, but we work to protect your data.',
          ],
        },
        {
          h: 'Children',
          p: [
            'The app is not for anyone under 18. We do not knowingly collect data from children.',
          ],
        },
        {
          h: 'Changes to this policy',
          p: [
            'We may update this policy. The date at the top shows the latest version. If a change is important, we will tell you in the app.',
          ],
        },
        { h: 'Contact', p: [`${c.company} · ${c.email} · ${c.phone}`] },
      ];
    case 'privacy.am':
      return [
        {
          h: 'ስለዚህ ፖሊሲ',
          p: [
            `ገብቷል (Gebtual / Smart Verify) የኢትዮጵያ ምግብ ቤቶችና ሱቆች የባንክና የቴሌብር ክፍያዎችን እንዲያረጋግጡ፣ ትዕዛዞችን፣ ሂሳቦችንና ሪፖርቶችን እንዲያስተዳድሩ የሚረዳ የሞባይል መተግበሪያ ነው። የሚያስተዳድረው ${c.company} ነው። ይህ ፖሊሲ ምን እንደምንሰበስብ፣ ለምን እንደሆነና ምርጫዎ ምን እንደሆነ ያብራራል።`,
          ],
        },
        {
          h: 'ምን እንሰበስባለን',
          p: [
            '- የባለቤትና የሥራ አስኪያጅ ኢሜይል።',
            '- የሠራተኞች ስምና ስልክ ቁጥር።',
            '- ፒን። የምናስቀምጠው የተመሰጠረ (hash) ቅጽ ብቻ ነው፤ ፒኑን ራሱ አናስቀምጥም።',
            '- የንግድ ስምና ቦታ (አድራሻና ጂፒኤስ)።',
            '- የሚመዘግቧቸው ትዕዛዞች፣ ሂሳቦች፣ ቲፕ፣ ወጪዎችና ግዢዎች።',
            '- ክፍያ ለመፈተሽ የሚያስገቡት የባንክ ሂሳብ ስምና ቁጥር።',
            '- ለማረጋገጥ የሚያስገቡት የክፍያ ማጣቀሻና የደረሰኝ ፎቶ።',
            '- ማሳወቂያ ለመላክ የስልክዎ የማሳወቂያ ቶከን።',
            '- መሠረታዊ ሎጎች (ለምሳሌ ስህተቶችና የምላሽ ጊዜ)።',
          ],
        },
        {
          h: 'ለምን እንጠቀምበታለን',
          p: [
            '- ክፍያዎችን ለማረጋገጥ።',
            '- የንግድዎን ትዕዛዞችና ሪፖርቶች ለማስተዳደር።',
            '- ማሳወቂያ ለመላክ።',
            '- ለአባልነት ክፍያ።',
            '- ለድጋፍ።',
          ],
        },
        {
          h: 'መተግበሪያው የሚጠይቃቸው ፈቃዶች',
          p: [
            '- ቦታ፦ የንግድዎን ቦታ ለማስቀመጥ። አማራጭ ነው።',
            '- ካሜራና ፎቶዎች፦ የክፍያ ደረሰኞችን ለማንበብ።',
            '- ማሳወቂያዎች፦ ስለ ክፍያዎችና ትዕዛዞች ለማሳወቅ።',
          ],
        },
        {
          h: 'ከማን ጋር እናጋራለን',
          p: [
            'መተግበሪያውን ለማስኬድ ከሚያስፈልጉ አገልግሎት ሰጪዎች ጋር ብቻ፦ ማስተናገጃ (hosting)፣ ኢሜይል፣ ካርታ፣ እና የባንክ ወይም የቴሌብር ማረጋገጫ። መረጃዎን ፈጽሞ አንሸጥም።',
          ],
        },
        {
          h: 'በቴሌግራም የድጋፍ ውይይት',
          p: [
            'በቴሌግራም ለድጋፍ ቦታችን ቢጽፉ፣ የድጋፍ ቡድናችን መልዕክቶችዎን፣ የቴሌግራም ስምዎንና የተጠቃሚ ስምዎን እንዲሁም የሚልኳቸውን ፎቶዎች የሚያነበው እርስዎን ለመመለስ ብቻ ነው። እነዚህ ውይይቶች በቴሌግራም የራሱ የግላዊነት ፖሊሲ የሚተዳደሩ ሲሆን፣ ከጫፍ እስከ ጫፍ የተመሰጠሩ አይደሉም። ፒንዎን ወይም የይለፍ ቃልዎን በድጋፍ ውይይት በጭራሽ አይላኩ። የደረሰኝ ፎቶ የሂሳብ ቁጥር ሊያሳይ ስለሚችል፣ ስንጠይቅ ብቻ ይላኩ።',
          ],
        },
        {
          h: 'ለምን ያህል ጊዜ እናቆያለን፣ መረጃ ስለማጥፋት',
          p: [
            'መለያዎ ንቁ እስከሆነ ድረስ መረጃዎን እናቆያለን። መለያዎንና መረጃዎን ለማጥፋት ከመለያዎ ኢሜይል ወደ ታች ባለው አድራሻ ኢሜይል ይላኩልን። በ30 ቀን ውስጥ እናጠፋለን።',
          ],
        },
        {
          h: 'ደህንነት',
          p: [
            'መረጃ በHTTPS ይላካል፣ ፒኖች ይመሰጠራሉ፣ መዳረሻም ለሚያስፈልጋቸው ሰዎች ብቻ የተገደበ ነው። ምንም ሥርዓት ፍጹም ደህንነቱ የተጠበቀ አይደለም፤ ሆኖም መረጃዎን ለመጠበቅ እንሠራለን።',
          ],
        },
        {
          h: 'ልጆች',
          p: ['መተግበሪያው ከ18 ዓመት በታች ለሆኑ አይደለም። ከልጆች መረጃ ሆን ብለን አንሰበስብም።'],
        },
        {
          h: 'የፖሊሲው ለውጥ',
          p: [
            'ይህንን ፖሊሲ ልናሻሽል እንችላለን። ከላይ ያለው ቀን የቅርብ ጊዜውን ስሪት ያሳያል። አስፈላጊ ለውጥ ካለ በመተግበሪያው እናሳውቃለን።',
          ],
        },
        { h: 'ያግኙን', p: [`${c.company} · ${c.email} · ${c.phone}`] },
      ];
    case 'terms.en':
      return [
        {
          h: 'Agreement',
          p: [
            `These terms are between you and ${c.company} for the ገብቷል (Gebtual / Smart Verify) app. By creating an account or using the app you agree to them and to our Privacy Policy.`,
          ],
        },
        {
          h: 'Who can use it',
          p: [
            'The app is for restaurant and shop owners and their staff, aged 18 or over. The owner is responsible for the staff they add and for everything done in the business account.',
          ],
        },
        {
          h: 'Plans, payment and renewal',
          p: [
            'There are two plans: Normal Verify (payment verification) and Restaurant Plus (everything in Normal Verify, plus ordering, billing and admin). Prices are shown in the app in ETB.',
            'Subscriptions are paid in advance for the period shown and renew each period. If you do not pay by the due date, we may limit or suspend access until you do. Paid periods are not refunded unless the law requires it.',
          ],
        },
        {
          h: 'Payment verification',
          p: [
            'Verification results depend on data from banks and Telebirr, and on the receipt or reference you give us. These sources can be late, wrong or unavailable. A result is a help, not a guarantee. You must still confirm that the money reached your account before you hand over goods or services.',
          ],
        },
        {
          h: 'Acceptable use',
          p: [
            '- Do not use the app for fraud, fake receipts or anything illegal.',
            '- Do not share your sign-in or PIN, or try to get into other accounts.',
            '- Do not try to disrupt, copy or reverse-engineer the service.',
          ],
        },
        {
          h: 'Suspension',
          p: [
            'We may suspend or close an account for abuse, breaking these terms, or non-payment. You can stop using the app at any time and ask us to delete your data (see the Privacy Policy).',
          ],
        },
        {
          h: 'Limit of liability',
          p: [
            'The app is provided as is. To the extent the law allows, we are not liable for lost sales, unpaid orders, wrong or late verification results, or other indirect losses. Our total liability is limited to the amount you paid us in the 3 months before the claim.',
          ],
        },
        { h: 'Governing law', p: ['These terms are governed by the laws of Ethiopia.'] },
        {
          h: 'Changes',
          p: [
            'We may change these terms. The date at the top shows the latest version. If you keep using the app after a change, you accept it.',
          ],
        },
        { h: 'Contact', p: [`${c.company} · ${c.email} · ${c.phone}`] },
      ];
    case 'terms.am':
      return [
        {
          h: 'ስምምነት',
          p: [
            `እነዚህ ውሎች ለገብቷል (Gebtual / Smart Verify) መተግበሪያ በእርስዎና በ${c.company} መካከል ናቸው። መለያ በመክፈት ወይም መተግበሪያውን በመጠቀም እነዚህንና የግላዊነት ፖሊሲያችንን ተቀብለዋል።`,
          ],
        },
        {
          h: 'ማን ሊጠቀም ይችላል',
          p: [
            'መተግበሪያው ዕድሜያቸው 18 እና ከዚያ በላይ ለሆኑ የምግብ ቤትና የሱቅ ባለቤቶችና ሠራተኞቻቸው ነው። ባለቤቱ ለሚጨምራቸው ሠራተኞችና በንግድ መለያው ለሚደረግ ማንኛውም ነገር ኃላፊነት አለበት።',
          ],
        },
        {
          h: 'እቅዶች፣ ክፍያና እድሳት',
          p: [
            'ሁለት እቅዶች አሉ፦ Normal Verify (ክፍያ ማረጋገጥ) እና Restaurant Plus (ሁሉም የNormal Verify ነገሮች፣ ከዚያ በተጨማሪ ትዕዛዝ፣ ሂሳብ አከፋፈልና አስተዳደር)። ዋጋዎች በመተግበሪያው በብር ይታያሉ።',
            'አባልነት ለሚታየው ጊዜ አስቀድሞ ይከፈላል፤ በየጊዜው ይታደሳል። እስከ ክፍያ ቀን ካልከፈሉ እስኪከፍሉ ድረስ መዳረሻን ልንገድብ ወይም ልናግድ እንችላለን። ሕግ ካልጠየቀ በስተቀር የተከፈለ ጊዜ አይመለስም።',
          ],
        },
        {
          h: 'ክፍያ ማረጋገጥ',
          p: [
            'የማረጋገጫ ውጤት ከባንኮችና ከቴሌብር በሚመጣ መረጃ እንዲሁም በሚሰጡን ደረሰኝ ወይም ማጣቀሻ ላይ ይወሰናል። እነዚህ ምንጮች ሊዘገዩ፣ ሊሳሳቱ ወይም ላይገኙ ይችላሉ። ውጤቱ እገዛ ነው እንጂ ዋስትና አይደለም። ዕቃ ወይም አገልግሎት ከመስጠትዎ በፊት ገንዘቡ ወደ ሂሳብዎ መግባቱን እርስዎ ራስዎ ማረጋገጥ አለብዎት።',
          ],
        },
        {
          h: 'ተቀባይነት ያለው አጠቃቀም',
          p: [
            '- መተግበሪያውን ለማጭበርበር፣ ለሐሰተኛ ደረሰኝ ወይም ሕገ ወጥ ነገር አይጠቀሙ።',
            '- መግቢያዎን ወይም ፒንዎን አያጋሩ፤ ወደ ሌሎች መለያዎች ለመግባት አይሞክሩ።',
            '- አገልግሎቱን ለማወክ፣ ለመቅዳት ወይም ለመበተን አይሞክሩ።',
          ],
        },
        {
          h: 'መታገድ',
          p: [
            'ለአላግባብ አጠቃቀም፣ ውሎችን በመጣስ ወይም ባለመክፈል መለያን ልናግድ ወይም ልንዘጋ እንችላለን። መተግበሪያውን በማንኛውም ጊዜ መተው እና መረጃዎ እንዲጠፋ መጠየቅ ይችላሉ (የግላዊነት ፖሊሲን ይመልከቱ)።',
          ],
        },
        {
          h: 'የኃላፊነት ገደብ',
          p: [
            'መተግበሪያው እንዳለ ይቀርባል። ሕግ በፈቀደው መጠን ለጠፋ ሽያጭ፣ ላልተከፈለ ትዕዛዝ፣ ለተሳሳተ ወይም ለዘገየ የማረጋገጫ ውጤት ወይም ለሌሎች ቀጥተኛ ላልሆኑ ኪሳራዎች ኃላፊነት የለብንም። ጠቅላላ ኃላፊነታችን ከጥያቄው በፊት በነበሩት 3 ወራት ለእኛ በከፈሉት መጠን የተገደበ ነው።',
          ],
        },
        { h: 'የሚገዛ ሕግ', p: ['እነዚህ ውሎች በኢትዮጵያ ሕጎች ይገዛሉ።'] },
        {
          h: 'ለውጦች',
          p: [
            'እነዚህን ውሎች ልንቀይር እንችላለን። ከላይ ያለው ቀን የቅርብ ጊዜውን ስሪት ያሳያል። ከለውጥ በኋላ መተግበሪያውን መጠቀም ከቀጠሉ ለውጡን ተቀብለዋል።',
          ],
        },
        { h: 'ያግኙን', p: [`${c.company} · ${c.email} · ${c.phone}`] },
      ];
  }
}
