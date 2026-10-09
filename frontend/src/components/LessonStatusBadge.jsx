import Badge from "./Badge";
import { lessonState, STATUS_BADGE } from "../utils/bookings";

/** Potvrđen / U toku / Održan / Otkazan, isto u svim panelima. */
export default function LessonStatusBadge({ booking, now }) {
  const { type, label } = STATUS_BADGE[lessonState(booking, now)];
  return <Badge type={type}>{label}</Badge>;
}
