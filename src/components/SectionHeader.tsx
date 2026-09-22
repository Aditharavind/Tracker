import { X } from "lucide-react";

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  id?: string;
  className?: string;
  level?: 1 | 2 | 3;
  variant?: "primary" | "secondary" | "sub";
  onClose?: () => void;
  closeLabel?: string;
};

export default function SectionHeader({
  title,
  eyebrow,
  subtitle,
  id,
  className = "",
  level = 2,
  variant = "primary",
  onClose,
  closeLabel = "Close",
}: SectionHeaderProps) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";

  return (
    <header className={`section-header section-header-${variant}${className ? ` ${className}` : ""}`}>
      <div className="section-header-copy">
        {eyebrow && <p className="section-eyebrow pixel-font">{eyebrow}</p>}
        <Heading id={id} className="section-title pixel-font">
          {title}
        </Heading>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {onClose && (
        <button type="button" className="panel-close section-header-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
          <X size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
