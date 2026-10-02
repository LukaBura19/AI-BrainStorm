/** Small, code-native subject diagrams used only behind the selection title. */
export default function SubjectBackdrop({ name }) {
  const subject = String(name || "").toLocaleLowerCase("sr-Latn");
  let drawing;

  if (subject.includes("matemat")) {
    drawing = <>
      <path d="M24 161H256M69 24V189M28 148C65 151 79 134 111 81S170 35 203 94 233 149 256 127" />
      <path className="subject-diagram-secondary" d="M27 48C80 49 116 183 174 151S226 48 256 42M50 78H225M112 35V177M157 35V177M203 35V177" />
      <circle cx="111" cy="81" r="5" /><circle cx="203" cy="94" r="5" />
    </>;
  } else if (subject.includes("fizik")) {
    drawing = <>
      <ellipse cx="140" cy="105" rx="106" ry="38" />
      <ellipse cx="140" cy="105" rx="106" ry="38" transform="rotate(60 140 105)" />
      <ellipse cx="140" cy="105" rx="106" ry="38" transform="rotate(120 140 105)" />
      <circle className="subject-diagram-core" cx="140" cy="105" r="16" />
      <circle cx="37" cy="95" r="5" /><circle cx="184" cy="25" r="5" /><circle cx="194" cy="188" r="5" />
    </>;
  } else if (subject.includes("hemij")) {
    drawing = <>
      <path d="M56 82 91 61 127 82V124L91 145 56 124ZM127 82 163 61 199 82V124L163 145 127 124ZM199 124 233 145M56 82 26 64M91 145V179M163 61V27" />
      <path className="subject-diagram-secondary" d="M64 89V117L91 133M99 74 118 86M139 87 163 73 187 87M141 121 164 134" />
      <circle cx="26" cy="64" r="9" /><circle cx="91" cy="184" r="8" /><circle cx="163" cy="23" r="8" /><circle cx="237" cy="148" r="10" />
    </>;
  } else if (subject.includes("informat") || subject.includes("program")) {
    drawing = <>
      <path d="M64 37H42V173H64M216 37H238V173H216M99 63 76 85 99 106M181 104 204 126 181 147M154 49 127 163" />
      <path className="subject-diagram-secondary" d="M78 26H162M78 34H135M101 180H206M154 188H206M102 125H74M177 80H211" />
      <circle cx="68" cy="185" r="5" /><circle cx="215" cy="25" r="5" />
    </>;
  } else if (subject.includes("filoz")) {
    drawing = <>
      <circle cx="111" cy="100" r="66" /><circle cx="169" cy="100" r="66" />
      <path d="M66 158 51 183 94 164M137 35V18M137 185V196" />
      <path className="subject-diagram-secondary" d="M66 72H117M62 87H101M171 117H218M182 133H218" />
    </>;
  } else {
    drawing = <>
      <path d="M30 43C77 24 111 33 140 52 169 33 203 24 250 43V171C208 153 173 160 140 180 107 160 72 153 30 171ZM140 52V180" />
      <path className="subject-diagram-secondary" d="M47 62C72 54 98 58 120 69M47 82C74 74 98 78 120 89M48 122C74 114 97 117 120 128M48 143C74 135 97 138 120 149M160 69C183 58 208 54 233 62M160 89C183 78 208 74 233 82M160 128C183 117 208 114 233 122M160 149C183 138 208 135 233 143" />
    </>;
  }

  return <svg className="booking-subject-diagram" viewBox="0 0 280 210" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing}</svg>;
}
