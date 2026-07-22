import Link from "next/link";
import { ScanSearch } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="ClassTrace">
      <span className="logo-mark"><ScanSearch aria-hidden="true" size={19} /></span>
      {!compact && <span>ClassTrace</span>}
    </span>
  );
}

export function LogoHomeLink({ compact = false }: { compact?: boolean }) {
  return <Link href="/" aria-label="ClassTrace home"><Logo compact={compact} /></Link>;
}
