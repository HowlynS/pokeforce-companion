// Shared inner section card for the main editor column (Admin Editor
// Section Redesign pass): the ONE place every "logical content
// category" — Identity, Description, Classification, Output, Source,
// Linked Context, ... — becomes a subtly bordered card with an
// icon-bubble heading, replacing the old long full-width
// .form-section-heading divider line. One shared component so no page
// hand-rolls its own card markup; every section everywhere shares the
// same surface, border, radius, padding, and heading treatment.
//
// Deliberately ONE card per logical category, never one per field —
// callers group their own related fields as children exactly like they
// already did inside the old .form-grid, just inside this wrapper
// instead of under a bare heading paragraph.
//
// headingLevel defaults to "h2": on every page this renders, the page's
// own h1 (EditorHeader's title) is the only heading above it, so a
// section title is correctly the next level down. A caller nesting
// sections inside another heading level (none currently do) can pass
// "h3" instead — never hardcoded, so the semantic outline stays correct
// wherever this is used.

import type { LucideIcon } from "lucide-react";
import { SectionIcon } from "@/components/admin/section-icon";

type EditorSectionProps = {
  title: string;
  icon: LucideIcon;
  /** A short, restrained line under the heading — e.g. a relationship
      tab's own record count ("2 recipes"). Mirrors ContextPanel's own
      identical `description` prop, so the two card systems stay
      consistent wherever a caller happens to use either. Omitted
      entirely (no empty paragraph) when not supplied. */
  description?: string;
  children: React.ReactNode;
  headingLevel?: "h2" | "h3";
  /** Appended alongside the base classes — e.g. the auto-flow section
      grid's own full-width-span utility. Never a replacement. */
  className?: string;
  /** Rarely needed — an in-page anchor target (e.g. the Game Versions
      settings page's own "+ New game version" jump link). */
  id?: string;
};

export function EditorSection({
  title,
  icon,
  description,
  children,
  headingLevel = "h2",
  className,
  id,
}: EditorSectionProps) {
  const Heading = headingLevel;

  return (
    <section
      id={id}
      className={
        className ? `admin-editor-section ${className}` : "admin-editor-section"
      }
    >
      <div className="admin-editor-section-heading">
        <SectionIcon icon={icon} />
        <div className="admin-editor-section-heading-text">
          <Heading className="admin-editor-section-title">{title}</Heading>
          {description ? (
            <p className="admin-editor-section-description">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="admin-editor-section-body">{children}</div>
    </section>
  );
}
