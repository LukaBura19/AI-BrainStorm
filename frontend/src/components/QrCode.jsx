import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** QR kod kao SVG: tamni moduli su jedna putanja, sa belom ivicom koju kamere traže. */
export default function QrCode({ value, label, size = 112 }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const modules = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
    return { count: modules, path: d };
  }, [value]);

  return (
    <svg className="qr-code" role="img" aria-label={label} width={size} height={size} viewBox={`-2 -2 ${count + 4} ${count + 4}`} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={count + 4} height={count + 4} fill="#fff" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}
