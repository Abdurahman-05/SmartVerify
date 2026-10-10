import { useTranslation } from 'react-i18next';

/** The Amharic name when the app is in Amharic and one exists, otherwise the English name. */
export function useLocalName() {
  const { i18n } = useTranslation();
  const amharic = i18n.language === 'am';
  return (item: { name: string; nameAm?: string | null }) =>
    amharic && item.nameAm ? item.nameAm : item.name;
}
