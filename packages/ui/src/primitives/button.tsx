import type { AnchorHTMLAttributes } from "react";

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: string;
};

export function Button({ children, className = "", href, ...props }: ButtonProps) {
  return (
    <a
      href={href}
      className={`inline-flex items-center rounded-lg bg-ballast-tide px-4 py-2 text-sm font-medium text-white ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
