import {
  cloneElement,
  useState,
  useRef,
  useCallback,
  type ReactElement,
  type MouseEvent,
  type FocusEvent,
} from "react";

export interface TooltipProps {
  label: string;
  children: ReactElement<{
    title?: string;
    "aria-label"?: string;
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
  }>;
  /** Delay in ms before showing the tooltip (default 400) */
  delay?: number;
  /** Preferred placement (default "top") */
  placement?: "top" | "bottom" | "left" | "right";
  /** Disable the tooltip */
  disabled?: boolean;
}

interface Position {
  left: number;
  top: number;
}

function computePosition(
  anchor: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  placement: "top" | "bottom" | "left" | "right",
): Position {
  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left: number;
  let top: number;
  let actualPlacement = placement;

  switch (placement) {
    case "top":
      left = anchor.left + anchor.width / 2 - tooltipWidth / 2;
      top = anchor.top - tooltipHeight - gap;
      break;
    case "bottom":
      left = anchor.left + anchor.width / 2 - tooltipWidth / 2;
      top = anchor.bottom + gap;
      break;
    case "left":
      left = anchor.left - tooltipWidth - gap;
      top = anchor.top + anchor.height / 2 - tooltipHeight / 2;
      break;
    case "right":
      left = anchor.right + gap;
      top = anchor.top + anchor.height / 2 - tooltipHeight / 2;
      break;
  }

  if (actualPlacement === "top" && top < 4) {
    top = anchor.bottom + gap;
    actualPlacement = "bottom";
  } else if (actualPlacement === "bottom" && top + tooltipHeight > vh - 4) {
    top = anchor.top - tooltipHeight - gap;
    actualPlacement = "top";
  }

  left = Math.max(4, Math.min(left, vw - tooltipWidth - 4));

  return { left, top };
}

export function Tooltip({
  label,
  children,
  delay = 400,
  placement = "top",
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (anchorEl: HTMLElement) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const anchor = anchorEl.getBoundingClientRect();
        const tw = label.length * 7 + 16;
        const th = 24;
        setPos(computePosition(anchor, tw, th, placement));
        setVisible(true);
      }, delay);
    },
    [delay, label.length, placement],
  );

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setPos(null);
  }, []);

  const handleMouseEnter = useCallback(
    (e: MouseEvent) => {
      if (children.props.onMouseEnter) children.props.onMouseEnter(e);
      if (!disabled) show(e.currentTarget as HTMLElement);
    },
    [children.props, disabled, show],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      if (children.props.onMouseLeave) children.props.onMouseLeave(e);
      hide();
    },
    [children.props, hide],
  );

  const handleFocus = useCallback(
    (e: FocusEvent) => {
      if (children.props.onFocus) children.props.onFocus(e);
      if (!disabled) show(e.currentTarget as HTMLElement);
    },
    [children.props, disabled, show],
  );

  const handleBlur = useCallback(
    (e: FocusEvent) => {
      if (children.props.onBlur) children.props.onBlur(e);
      hide();
    },
    [children.props, hide],
  );

  const child = cloneElement(children, {
    "aria-label": children.props["aria-label"] ?? label,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  });

  return (
    <>
      {child}
      {visible && pos && !disabled ? (
        <div
          className="fo-tooltip"
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
}
