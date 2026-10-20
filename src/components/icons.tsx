// Icons: Phosphor, regular weight, currentColor (NamMa design system → Iconography).
// Always paired with text, so they are hidden from screen readers. Tier shapes and the house
// mark are CSS (nm-shape, nm-house), not icons.
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Bell,
  Buildings,
  CaretLeft,
  CaretRight,
  ChatCircleText,
  Crosshair,
  Desktop,
  House,
  MapPin,
  MapTrifold,
  Microphone,
  MagnifyingGlass,
  Minus,
  Moon,
  PaperPlaneRight,
  PencilSimple,
  Phone,
  SidebarSimple,
  Sun,
  Trash,
  UserCircle,
  Users,
  Warning,
  Waves,
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

export const ChatIcon = wrap(ChatCircleText);
export const MapIcon = wrap(MapTrifold);
export const FloodIcon = wrap(Waves);
export const SendIcon = wrap(PaperPlaneRight);
export const LocateIcon = wrap(Crosshair);
export const PinIcon = wrap(MapPin);
export const ChevronLeftIcon = wrap(CaretLeft);
export const AlertIcon = wrap(Warning);
export const ArrowUpIcon = wrap(ArrowUp);
export const ArrowRightIcon = wrap(ArrowRight);
export const MicIcon = wrap(Microphone);
export const TrashIcon = wrap(Trash);
export const PencilIcon = wrap(PencilSimple);
export const UserIcon = wrap(UserCircle);
export const ArrowDownIcon = wrap(ArrowDown);
export const MinusIcon = wrap(Minus);
export const SearchIcon = wrap(MagnifyingGlass);
export const SunIcon = wrap(Sun);
export const MoonIcon = wrap(Moon);
export const AutoThemeIcon = wrap(Desktop);
export const PhoneIcon = wrap(Phone);

/** LINE's speech-bubble glyph, only on LINE buttons and the @1784DDPM link (swap for the official asset). */
export const SidebarIcon = wrap(SidebarSimple);
export const HouseIcon = wrap(House);
export const UsersIcon = wrap(Users);
export const BuildingsIcon = wrap(Buildings);
export const BellIcon = wrap(Bell);
export const CaretRightIcon = wrap(CaretRight);
export const CloseIcon = wrap(X);
export const LineIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8z" />
  </svg>
);
/** Google's four-colour "G" (brand colours are fixed, never themed). Only on the Google sign-in button. */
export const GoogleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true" {...p}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);
