import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastStack } from "../src/components/ToastStack";

describe("ToastStack", () => {
  it("renders toast actions and dismisses", () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();

    render(
      <ToastStack
        toasts={[
          {
            id: "toast-1",
            tone: "error",
            title: "Operation failed",
            detail: "Permission denied",
            actionLabel: "View details",
            onAction,
          },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Operation failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });
});
