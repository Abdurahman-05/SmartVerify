import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

const fonts = {
  body: 'font-body',
  medium: 'font-body-medium',
  semibold: 'font-body-semibold',
  bold: 'font-body-bold',
  heading: 'font-heading',
} as const;

const tones = {
  default: 'text-text',
  muted: 'text-muted',
  link: 'text-primaryText',
  inverse: 'text-surface',
} as const;

export interface TextProps extends RNTextProps {
  font?: keyof typeof fonts;
  tone?: keyof typeof tones;
}

// Custom fonts need one family per weight; fontWeight alone does not switch files on Android.
export function Text({ font = 'body', tone = 'default', className = '', ...props }: TextProps) {
  return <RNText className={`${fonts[font]} ${tones[tone]} ${className}`} {...props} />;
}
