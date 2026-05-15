import { cloneElement, type ReactElement } from "react";

export interface TooltipProps {
  label: string;
  children: ReactElement<{ title?: string; "aria-label"?: string }>;
}

export function Tooltip({ label, children }: TooltipProps) {
  return cloneElement(children, {
    title: children.props.title ?? label,
    "aria-label": children.props["aria-label"] ?? label,
  });
}
