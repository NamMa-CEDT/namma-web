// Icons: Phosphor, regular weight, currentColor (NamMa design system → Iconography).
// Always paired with text, so they are hidden from screen readers. Tier shapes and the house
// mark are CSS (nm-shape, nm-house), not icons.
import {
  ArrowDown,
  ArrowUp,
  CaretLeft,
  ChatCircleText,
  Crosshair,
  MapPin,
  MapTrifold,
  Minus,
  PaperPlaneRight,
  Phone,
  ShieldCheck,
  Users,
  Warning,
  X,
  type Icon as PhosphorIcon,
  type IconProps,
} from "@phosphor-icons/react";
import type { SVGProps } from "react";

function wrap(Icon: PhosphorIcon) {
  const Wrapped = (p: IconProps) => <Icon weight="regular" aria-hidden="true" focusable="false" {...p} />;
  Wrapped.displayName = `Icon(${Icon.displayName ?? "phosphor"})`;
  return Wrapped;
}

export const PhoneIcon = wrap(Phone);
export const ChatIcon = wrap(ChatCircleText);
export const MapIcon = wrap(MapTrifold);
export const ShieldIcon = wrap(ShieldCheck);
export const SendIcon = wrap(PaperPlaneRight);
export const LocateIcon = wrap(Crosshair);
export const PinIcon = wrap(MapPin);
export const CloseIcon = wrap(X);
export const ChevronLeftIcon = wrap(CaretLeft);
export const AlertIcon = wrap(Warning);
export const ArrowUpIcon = wrap(ArrowUp);
export const ArrowDownIcon = wrap(ArrowDown);
export const MinusIcon = wrap(Minus);
export const UsersIcon = wrap(Users);

/** LINE's speech-bubble glyph, only on LINE buttons and the @1784DDPM link (swap for the official asset). */
export const LineIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8z" />
  </svg>
);
