import { useId } from "react";
import "./BrandLogo.css";

// Frame the original transparent artwork; preserve the supplied brand exactly.
export default function BrandLogo({ compact = false, markOnly = false, header = false }) {
  const markClip = useId();
  return <span className={`brand-logo ${compact ? "brand-logo--compact" : ""} ${markOnly ? "brand-logo--mark" : ""} ${header ? "brand-logo--header" : ""}`} role="img" aria-label="BrainStorm edukativni centar">
    <svg className="brand-logo-icon" viewBox="395 235 490 300" aria-hidden="true" focusable="false">
      <defs><clipPath id={markClip}><rect x="395" y="235" width="490" height="300" /></clipPath></defs>
      <image href="/assets/logo2.png" width="1280" height="1024" clipPath={`url(#${markClip})`} />
    </svg>
    {header ? <span className="brand-logo-name"><span>BrainStorm</span><span>Edukativni centar</span></span> : !markOnly && <span className="brand-logo-type">
      <svg viewBox="333 575 660 67" aria-hidden="true" focusable="false"><image href="/assets/logo2.png" width="1280" height="1024" /></svg>
      <span>edukativni centar</span>
    </span>}
  </span>;
}
