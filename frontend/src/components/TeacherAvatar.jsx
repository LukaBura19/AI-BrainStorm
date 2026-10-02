export default function TeacherAvatar({ name }) {
  const parts = String(name || "?").trim().split(/\s+/);
  const initials = `${parts[0][0]}${parts.length > 1 ? parts.at(-1)[0] : ""}`.toUpperCase();
  return <span className="booking-teacher-avatar" aria-hidden="true">
    <span className="teacher-avatar-halo" />
    <span className="teacher-avatar-orbit teacher-avatar-orbit--one"><i /></span>
    <span className="teacher-avatar-orbit teacher-avatar-orbit--two"><i /></span>
    <span className="teacher-avatar-disc"><span>{initials}</span></span>
  </span>;
}
