/**
 * ContextMenu: React component that renders a positioned context menu.
 *
 * Renders a list of MenuItem objects at the specified screen position.
 * Closes on click outside, Escape key, or item selection.
 */

import { useEffect, useRef, useCallback } from "react";
import type { MenuItem, MenuTarget } from "./types";

export interface ContextMenuProps {
  /** Items to display. */
  items: MenuItem[];
  /** The right-click target (provides position). */
  target: MenuTarget;
  /** Called when the menu should close. */
  onClose: () => void;
}

export function ContextMenu({ items, target, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="context-menu"
      style={{
        position: "fixed",
        left: target.position.x,
        top: target.position.y,
        zIndex: "var(--g3t-z-popover, 9999)" as unknown as number,
        background: "var(--g3t-bg-primary, white)",
        border: "1px solid var(--g3t-border, #ccc)",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
        color: "var(--g3t-text-primary, #212529)",
        colorScheme: "var(--g3t-color-scheme, light)" as never,
        minWidth: 180,
        padding: "4px 0",
      }}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separator && (
            <hr
              style={{
                margin: "4px 8px",
                border: "none",
                borderTop: "1px solid var(--g3t-border, #eee)",
              }}
            />
          )}
          <button
            role="menuitem"
            className="g3t-menu-item"
            data-testid={`menu-item-${item.id}`}
            onClick={() => {
              item.action(target);
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              color: "var(--g3t-text-primary, inherit)",
              cursor: "pointer",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
