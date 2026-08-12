"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { publicMotionDuration } from "@/lib/public-motion";

// The handoff's World dropdown lists World Navigation (Recommended),
// Locations, Shops and NPCs. The first three are real production routes;
// NPC still has no Prisma model or route anywhere in the app, so it stays
// absent rather than being stubbed. World Navigation is built strictly from
// real Location containment, never the prototype's region/NPC framing.
const worldItems = [
  {
    label: "World Navigation",
    href: "/world",
    description: "Region tree overview",
    recommended: true,
  },
  {
    label: "Locations",
    href: "/locations",
    description: "Cities, routes & landmarks",
    recommended: false,
  },
  {
    label: "Shops",
    href: "/shops",
    description: "Vendors & trade goods",
    recommended: false,
  },
] as const;

export function WorldMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();

  const active = worldItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const closeMenu = useCallback(() => {
    if (!open || closing) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, publicMotionDuration(180));
  }, [closing, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        buttonRef.current?.focus();
      }
    }

    // Capture phase, matching the handoff's own outside-click behavior.
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function toggleMenu() {
    if (closing) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
      return;
    }
    if (open) {
      closeMenu();
      return;
    }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
    setClosing(false);
  }

  return (
    <div className="public-world-menu" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={
          "public-world-menu-trigger" +
          (active ? " public-nav-link--active" : "")
        }
        aria-haspopup="true"
        aria-expanded={open && !closing}
        aria-controls={menuId}
        onClick={toggleMenu}
      >
        World
        <svg
          aria-hidden="true"
          width="9"
          height="9"
          viewBox="0 0 24 24"
          className="public-world-menu-chevron"
          style={{
            transform: open && !closing ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          className={`public-world-menu-panel ${closing ? "cx-menu-out" : "cx-menu-in"}`}
          aria-hidden={closing || undefined}
          inert={closing ? true : undefined}
        >
          {worldItems.map((item, index) => {
            const current =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={
                `public-world-menu-item ${closing ? "cx-item-out" : "cx-item-in"}` +
                (current ? " public-world-menu-item--current" : "")
              }
              style={{ animationDelay: closing ? "0ms" : `${index * 30}ms` }}
              onClick={closeMenu}
            >
              <span className="public-world-menu-item-label">
                {item.label}
                {item.recommended ? (
                  <span className="public-world-menu-item-badge">
                    Recommended
                  </span>
                ) : null}
              </span>
              <span className="public-world-menu-item-description">
                {item.description}
              </span>
            </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
