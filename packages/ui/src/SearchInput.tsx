import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

export type SearchInputProps = InputHTMLAttributes<HTMLInputElement>;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, type = "search", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cx("fo-ui-input", "fo-ui-search-input", className)}
        {...props}
      />
    );
  },
);
