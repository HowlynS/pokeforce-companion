// Reusable field-label row (Opus Pass 1): a real, explicitly-associated
// <label htmlFor> beside a discreet InfoTooltip trigger, sharing one
// consistent alignment. Kept a Server Component — only the InfoTooltip it
// renders is a client island — so any admin form can drop it in without
// pulling the whole page across the client boundary.
//
// The <label> is a SIBLING of the info trigger, never its parent: nesting
// the button inside the <label> would make clicking the icon also
// activate the label's implicit "focus the field" behavior. Kept
// separate, clicking the text still focuses the input (via htmlFor) while
// the info trigger stays independently interactive.

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/admin/info-tooltip";

type FieldLabelWithHelpProps = {
  /** The id of the input this label is associated with (htmlFor target). */
  htmlFor: string;
  /** The visible label text. */
  children: ReactNode;
  /** The explanatory copy the tooltip reveals. */
  helpContent: string;
  /** The accessible name of the info trigger, e.g. "More information about
      Minimum quantity". */
  helpLabel: string;
};

export function FieldLabelWithHelp({
  htmlFor,
  children,
  helpContent,
  helpLabel,
}: FieldLabelWithHelpProps) {
  return (
    <span className="form-field-label form-field-label--with-help">
      <label htmlFor={htmlFor} className="form-field-label-text">
        {children}
      </label>
      <InfoTooltip label={helpLabel} content={helpContent} />
    </span>
  );
}
