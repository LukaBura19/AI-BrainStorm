import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "./NotFoundPage.css";

function NotFoundPage() {
  return (
    <div className="not-found-page">
      <span className="not-found-number" aria-hidden="true">404</span>
      <p className="eyebrow">Mali zaokret na putu do znanja</p>
      <h1>Ova stranica je<br /><em className="editorial">ostala van rasporeda.</em></h1>
      <p>Stranica nije pronađena. Vratimo se na početak.</p>
      <Link to="/" className="btn btn-primary">
        Nazad na početnu <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default NotFoundPage;
