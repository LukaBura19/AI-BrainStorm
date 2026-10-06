import { Backpack, Presentation, ShieldCheck } from "lucide-react";

const ICONS = { student: Backpack, teacher: Presentation, admin: ShieldCheck };

/** One icon per account type, shared by the sign-in menu and the sign-in pages. */
export default function RoleIcon({ role, size = 20, strokeWidth = 1.8 }) {
  const Icon = ICONS[role];
  return Icon ? <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" /> : null;
}
