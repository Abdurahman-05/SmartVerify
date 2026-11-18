import Svg, { Path } from 'react-native-svg';

import {
  LOGO_ASPECT,
  LOGO_CHECK,
  LOGO_G,
  LOGO_LINES,
  LOGO_VIEWBOX,
} from '../../../assets/logo/gebtual-logo-kit/gebtual-logo-kit/gebtual-logo';
import { useGlass } from './glassTokens';

export type GebtualLogoVariant = 'theme' | 'onDark' | 'mono';

const WHITE = '#FFFFFF';
const CHECK_ON_DARK = '#FACC15';

/** The Gebtual ገ with speed lines and check. `theme` follows the active brand colours. */
export function GebtualLogo({
  width = 120,
  variant = 'theme',
  color = '#000000',
}: {
  width?: number;
  variant?: GebtualLogoVariant;
  color?: string;
}) {
  const g = useGlass();
  const body = variant === 'theme' ? g.primaryDeep : variant === 'onDark' ? WHITE : color;
  const check = variant === 'theme' ? g.primary2 : variant === 'onDark' ? CHECK_ON_DARK : color;
  return (
    <Svg width={width} height={width / LOGO_ASPECT} viewBox={LOGO_VIEWBOX}>
      <Path d={LOGO_G} fill={body} fillRule="evenodd" />
      <Path d={LOGO_LINES} fill={body} />
      <Path d={LOGO_CHECK} fill={check} />
    </Svg>
  );
}
