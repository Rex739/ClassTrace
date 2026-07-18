import { ScanSearch } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="ClassTrace">
      <span className="logo-mark"><ScanSearch aria-hidden="true" size={19} /></span>
      {!compact && <span>ClassTrace</span>}
    </span>
  );
}
