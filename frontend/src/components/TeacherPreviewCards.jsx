import ScienceCard from "./ScienceCard";
import TeacherAvatar from "./TeacherAvatar";

const examples = [
  { name: "Pera Perić", subjects: ["Matematika", "Fizika"] },
  { name: "Ana Jovanović", subjects: ["Srpski jezik", "Engleski jezik"] },
  { name: "Marko Petrović", subjects: ["Informatika", "Matematika"] },
  { name: "Milica Nikolić", subjects: ["Hemija", "Fizika"] },
  { name: "Nikola Ilić", subjects: ["Engleski jezik", "Nemački jezik"] },
];

/** Disabled demonstration profiles never enter the real teacher list or booking state. */
export default function TeacherPreviewCards() {
  return examples.map(({ name, subjects }, index) => <ScienceCard key={name} className="booking-teacher-card booking-teacher-preview" data-preview="true" style={{ "--teacher-tone": `${245 + index * 18}` }} disabled>
    <TeacherAvatar name={name} />
    <span className="booking-teacher-copy"><span className="booking-teacher-note">Primer profila</span><strong>{name}</strong><span className="booking-teacher-subjects">{subjects.map(subject => <span key={subject}>{subject}</span>)}</span></span>
    <span className="booking-teacher-preview-label">Demonstracioni prikaz</span>
  </ScienceCard>);
}
