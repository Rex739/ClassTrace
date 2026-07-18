import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "button button-primary",
  secondary: "button button-secondary",
  ghost: "button button-ghost",
  danger: "button button-danger",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${styles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return <Link href={href} className={`${styles[variant]} ${className}`}>{children}</Link>;
}
