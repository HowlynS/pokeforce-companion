"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  Redo2,
  Search,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import {
  RESOURCE_LINK_SEARCH_MIN_LENGTH,
  type ResourceLinkOption,
} from "@/lib/admin/resource-link";
import { isSafeRichTextHref } from "@/lib/rich-text";
import {
  editorDocumentFromValue,
  serializeEditorDocument,
} from "@/lib/rich-text-editor";

const DIALOG_FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type RichDescriptionEditorProps = {
  label?: string;
  name?: string;
  initialValue?: unknown;
  fallbackText?: string | null;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  autoFocusOnError?: boolean;
};

type LinkSearchResponse = {
  results?: ResourceLinkOption[];
  result?: ResourceLinkOption | null;
};

type LinkPopoverState = {
  anchor: HTMLAnchorElement;
  href: string;
  from: number;
  to: number;
};

type LinkPopoverPosition = {
  left: number;
  top: number;
  placement: "above" | "below";
  ready: boolean;
};

const LINK_POPOVER_GAP = 8;
const LINK_POPOVER_VIEWPORT_MARGIN = 12;

function linkElementFromTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLAnchorElement>(".rich-editor-content a[href]")
    : null;
}

function linkRangeFromElement(editor: Editor, anchor: HTMLAnchorElement) {
  const textLength = anchor.textContent?.length ?? 0;
  if (textLength === 0) {
    return null;
  }
  try {
    const from = editor.view.posAtDOM(anchor, 0);
    return { from, to: from + textLength };
  } catch {
    return null;
  }
}

function linkElementAtSelection(editor: Editor) {
  if (!editor.isActive("link")) {
    return null;
  }
  try {
    const dom = editor.view.domAtPos(editor.state.selection.from);
    const element =
      dom.node instanceof Element ? dom.node : dom.node.parentElement;
    return element?.closest<HTMLAnchorElement>("a[href]") ?? null;
  } catch {
    return null;
  }
}

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
  buttonRef,
}: ToolbarButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="rich-editor-toolbar-button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichDescriptionEditor({
  label = "Description",
  name = "descriptionRich",
  initialValue,
  fallbackText,
  placeholder = "Add a clear, useful description…",
  error,
  required = false,
  autoFocusOnError = true,
}: RichDescriptionEditorProps) {
  const generatedId = useId();
  const editorId = `rich-description-${generatedId.replaceAll(":", "")}`;
  const labelId = `${editorId}-label`;
  const errorId = `${editorId}-error`;
  const dialogTitleId = `${editorId}-link-title`;
  const dialogDescriptionId = `${editorId}-link-description`;
  const hiddenRef = useRef<HTMLInputElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkPopoverCloseTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const initialDocument = useMemo(
    () => editorDocumentFromValue(initialValue, fallbackText),
    [initialValue, fallbackText]
  );
  const [serialized, setSerialized] = useState(() =>
    serializeEditorDocument(initialDocument)
  );
  const [revision, setRevision] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resourceQuery, setResourceQuery] = useState("");
  const [resourceResults, setResourceResults] = useState<ResourceLinkOption[]>([]);
  const [selectedResource, setSelectedResource] =
    useState<ResourceLinkOption | null>(null);
  const [resourceStatus, setResourceStatus] = useState<
    "idle" | "pending" | "searching" | "ready" | "error"
  >("idle");
  const [linkPopover, setLinkPopover] = useState<LinkPopoverState | null>(null);
  const [linkPopoverPosition, setLinkPopoverPosition] =
    useState<LinkPopoverPosition>({
      left: 0,
      top: 0,
      placement: "below",
      ready: false,
    });
  const [popoverResource, setPopoverResource] =
    useState<ResourceLinkOption | null>(null);
  const [popoverResourceLoading, setPopoverResourceLoading] = useState(false);

  const cancelLinkPopoverClose = useCallback(() => {
    if (linkPopoverCloseTimerRef.current !== null) {
      window.clearTimeout(linkPopoverCloseTimerRef.current);
      linkPopoverCloseTimerRef.current = null;
    }
  }, []);

  const closeLinkPopover = useCallback(() => {
    cancelLinkPopoverClose();
    setLinkPopover(null);
    setLinkPopoverPosition((current) => ({ ...current, ready: false }));
    setPopoverResource(null);
    setPopoverResourceLoading(false);
  }, [cancelLinkPopoverClose]);

  const scheduleLinkPopoverClose = useCallback(() => {
    cancelLinkPopoverClose();
    linkPopoverCloseTimerRef.current = window.setTimeout(() => {
      closeLinkPopover();
    }, 140);
  }, [cancelLinkPopoverClose, closeLinkPopover]);

  const showLinkPopoverForElement = useCallback(
    (currentEditor: Editor, anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute("href")?.trim();
      const range = linkRangeFromElement(currentEditor, anchor);
      if (!href || !range || !isSafeRichTextHref(href)) {
        return;
      }
      cancelLinkPopoverClose();
      setLinkPopover({
        anchor,
        href,
        from: range.from,
        to: range.to,
      });
      setPopoverResource(null);
      setPopoverResourceLoading(href.startsWith("/"));
      setLinkPopoverPosition((current) => ({ ...current, ready: false }));
    },
    [cancelLinkPopoverClose]
  );

  const syncLinkPopoverFromSelection = useCallback(
    (currentEditor: Editor) => {
      const anchor = linkElementAtSelection(currentEditor);
      if (anchor) {
        showLinkPopoverForElement(currentEditor, anchor);
      } else {
        window.requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          if (
            !linkPopoverRef.current?.contains(activeElement) &&
            !linkElementFromTarget(activeElement)
          ) {
            closeLinkPopover();
          }
        });
      }
    },
    [closeLinkPopover, showLinkPopoverForElement]
  );

  const editor = useEditor({
    immediatelyRender: false,
    content: initialDocument,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: { levels: [2, 3] },
        horizontalRule: false,
        link: {
          autolink: false,
          linkOnPaste: false,
          openOnClick: false,
          enableClickSelection: true,
          defaultProtocol: "https",
          protocols: [],
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: null,
            tabindex: "0",
          },
          isAllowedUri: (url) => isSafeRichTextHref(url),
        },
        orderedList: false,
        strike: false,
        trailingNode: false,
      }),
    ],
    editorProps: {
      attributes: {
        id: editorId,
        class: "rich-editor-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        "aria-invalid": error ? "true" : "false",
        ...(error ? { "aria-describedby": errorId } : {}),
        "data-placeholder": placeholder,
      },
    },
    onCreate: () => setRevision((value) => value + 1),
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setRevision((value) => value + 1);
      syncLinkPopoverFromSelection(currentEditor);
    },
    onTransaction: () => setRevision((value) => value + 1),
    onUpdate: ({ editor: currentEditor }) => {
      setSerialized(serializeEditorDocument(currentEditor.getJSON()));
    },
  });

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    dispatchFormChange(hiddenRef.current);
  }, [serialized]);

  useEffect(() => {
    if (!error || !autoFocusOnError || !editor) {
      return;
    }
    editor.commands.focus("start");
  }, [autoFocusOnError, editor, error]);

  useEffect(() => {
    if (!linkOpen) {
      return;
    }
    searchInputRef.current?.focus();
  }, [linkOpen]);

  useEffect(() => {
    if (!linkOpen) {
      return;
    }
    const query = resourceQuery.trim();
    if (query.length < RESOURCE_LINK_SEARCH_MIN_LENGTH) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResourceStatus("searching");
      try {
        const response = await fetch(
          `/admin/resource-links?q=${encodeURIComponent(query)}`,
          {
            credentials: "same-origin",
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error("Search failed");
        }
        const payload = (await response.json()) as LinkSearchResponse;
        setResourceResults(Array.isArray(payload.results) ? payload.results : []);
        setResourceStatus("ready");
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setResourceResults([]);
          setResourceStatus("error");
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [linkOpen, resourceQuery]);

  useEffect(() => {
    if (!linkOpen) {
      return;
    }
    const href = linkHref.trim();
    if (!href.startsWith("/") || selectedResource?.href === href) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/admin/resource-links?href=${encodeURIComponent(href)}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Resolution failed");
        }
        return (await response.json()) as LinkSearchResponse;
      })
      .then((payload) => {
        setSelectedResource(payload.result ?? null);
      })
      .catch((resolutionError) => {
        if ((resolutionError as Error).name !== "AbortError") {
          setSelectedResource(null);
        }
      });
    return () => controller.abort();
  }, [linkHref, linkOpen, selectedResource?.href]);

  useEffect(() => {
    if (!linkPopover) {
      return;
    }
    if (!linkPopover.href.startsWith("/")) {
      return;
    }
    const controller = new AbortController();
    void fetch(
      `/admin/resource-links?href=${encodeURIComponent(linkPopover.href)}`,
      {
        credentials: "same-origin",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Resolution failed");
        }
        return (await response.json()) as LinkSearchResponse;
      })
      .then((payload) => {
        setPopoverResource(payload.result ?? null);
        setPopoverResourceLoading(false);
      })
      .catch((resolutionError) => {
        if ((resolutionError as Error).name !== "AbortError") {
          setPopoverResource(null);
          setPopoverResourceLoading(false);
        }
      });
    return () => controller.abort();
  }, [linkPopover]);

  const updateLinkPopoverPosition = useCallback(() => {
    const popover = linkPopoverRef.current;
    if (!linkPopover || !popover || !linkPopover.anchor.isConnected) {
      return;
    }
    const anchorRect = linkPopover.anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const availableBelow =
      window.innerHeight - anchorRect.bottom - LINK_POPOVER_VIEWPORT_MARGIN;
    const availableAbove =
      anchorRect.top - LINK_POPOVER_VIEWPORT_MARGIN;
    const placement =
      availableBelow < popoverRect.height && availableAbove > availableBelow
        ? "above"
        : "below";
    const idealTop =
      placement === "above"
        ? anchorRect.top - popoverRect.height - LINK_POPOVER_GAP
        : anchorRect.bottom + LINK_POPOVER_GAP;
    const top = Math.max(
      LINK_POPOVER_VIEWPORT_MARGIN,
      Math.min(
        idealTop,
        window.innerHeight - popoverRect.height - LINK_POPOVER_VIEWPORT_MARGIN
      )
    );
    const left = Math.max(
      LINK_POPOVER_VIEWPORT_MARGIN,
      Math.min(
        anchorRect.left,
        window.innerWidth - popoverRect.width - LINK_POPOVER_VIEWPORT_MARGIN
      )
    );
    setLinkPopoverPosition({ left, top, placement, ready: true });
  }, [linkPopover]);

  useEffect(() => {
    if (!linkPopover) {
      return;
    }
    const frame = window.requestAnimationFrame(updateLinkPopoverPosition);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !linkPopover.anchor.contains(target) &&
        !linkPopoverRef.current?.contains(target)
      ) {
        closeLinkPopover();
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLinkPopover();
        window.setTimeout(() => linkButtonRef.current?.focus(), 0);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateLinkPopoverPosition);
    window.addEventListener("scroll", updateLinkPopoverPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateLinkPopoverPosition);
      window.removeEventListener("scroll", updateLinkPopoverPosition, true);
    };
  }, [
    closeLinkPopover,
    linkPopover,
    popoverResource,
    popoverResourceLoading,
    updateLinkPopoverPosition,
  ]);

  useEffect(
    () => () => {
      cancelLinkPopoverClose();
    },
    [cancelLinkPopoverClose]
  );

  function openLinkDialog(options?: {
    selection?: { from: number; to: number };
    href?: string;
  }) {
    if (!editor) {
      return;
    }
    const selection = options?.selection ?? editor.state.selection;
    linkSelectionRef.current = {
      from: selection.from,
      to: selection.to,
    };
    setLinkHref(
      options?.href ?? String(editor.getAttributes("link").href ?? "")
    );
    setLinkError(null);
    setResourceQuery("");
    setResourceResults([]);
    setSelectedResource(null);
    setResourceStatus("idle");
    closeLinkPopover();
    setLinkOpen(true);
  }

  function closeLinkDialog() {
    setLinkOpen(false);
    setLinkError(null);
    setSelectedResource(null);
    linkSelectionRef.current = null;
    window.setTimeout(() => linkButtonRef.current?.focus(), 0);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (!editor) {
      return;
    }
    const selection = linkSelectionRef.current ?? editor.state.selection;
    const linkIsActive = editor.isActive("link");
    if (selection.from === selection.to && !linkIsActive) {
      setLinkError("Select text in the description before adding a link.");
      return;
    }
    if (!isSafeRichTextHref(href)) {
      setLinkError("Use a canonical /path or a secure https:// URL.");
      return;
    }
    const chain = editor
      .chain()
      .focus()
      .setTextSelection({ from: selection.from, to: selection.to });
    if (linkIsActive) {
      chain.extendMarkRange("link");
    }
    chain.setLink({ href }).run();
    closeLinkDialog();
  }

  function removeLink() {
    if (!editor) {
      return;
    }
    const selection = linkSelectionRef.current ?? editor.state.selection;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: selection.from, to: selection.to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    closeLinkDialog();
  }

  function removePopoverLink() {
    if (!editor || !linkPopover) {
      return;
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkPopover.from, to: linkPopover.to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    closeLinkPopover();
  }

  function handleEditorMouseOver(event: MouseEvent<HTMLDivElement>) {
    const anchor = linkElementFromTarget(event.target);
    if (editor && anchor) {
      showLinkPopoverForElement(editor, anchor);
    }
  }

  function handleEditorMouseOut(event: MouseEvent<HTMLDivElement>) {
    const anchor = linkElementFromTarget(event.target);
    if (!anchor) {
      return;
    }
    const nextAnchor = linkElementFromTarget(event.relatedTarget);
    if (nextAnchor !== anchor) {
      scheduleLinkPopoverClose();
    }
  }

  function handleEditorFocus(event: FocusEvent<HTMLDivElement>) {
    const anchor = linkElementFromTarget(event.target);
    if (editor && anchor) {
      showLinkPopoverForElement(editor, anchor);
    }
  }

  function handleEditorBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (
      linkElementFromTarget(nextTarget) ||
      (nextTarget instanceof Node &&
        linkPopoverRef.current?.contains(nextTarget))
    ) {
      return;
    }
    scheduleLinkPopoverClose();
  }

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = linkElementFromTarget(event.target);
    if (!editor || !anchor) {
      return;
    }
    event.preventDefault();
    showLinkPopoverForElement(editor, anchor);
  }

  function focusResourceResult(index: number) {
    const button = resultButtonRefs.current[index];
    button?.focus();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLinkDialog();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function preventSelectionLoss(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("button")) {
      event.preventDefault();
    }
  }

  const ready = Boolean(editor);
  const isLinkActive = editor?.isActive("link") ?? false;
  const canCreateLink =
    ready && (!editor?.state.selection.empty || isLinkActive);
  void revision;

  return (
    <div className="form-field rich-description-field">
      <span id={labelId} className="form-field-label">
        {label}
        {required ? " (required)" : " (optional)"}
      </span>

      <div
        className="rich-description-editor"
        data-invalid={error ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onMouseOver={handleEditorMouseOver}
        onMouseOut={handleEditorMouseOut}
        onFocusCapture={handleEditorFocus}
        onBlurCapture={handleEditorBlur}
        onClickCapture={handleEditorClick}
      >
        <div
          className="rich-editor-toolbar"
          role="toolbar"
          aria-label={`${label} formatting`}
          onMouseDown={preventSelectionLoss}
        >
          <div className="rich-editor-toolbar-group" aria-label="Text formatting">
            <ToolbarButton
              label="Bold"
              active={editor?.isActive("bold") ?? false}
              disabled={!ready}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={editor?.isActive("italic") ?? false}
              disabled={!ready}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Underline"
              active={editor?.isActive("underline") ?? false}
              disabled={!ready}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline aria-hidden="true" />
            </ToolbarButton>
          </div>

          <div className="rich-editor-toolbar-group" aria-label="Block formatting">
            <ToolbarButton
              label="Section heading"
              active={editor?.isActive("heading", { level: 2 }) ?? false}
              disabled={!ready}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Subsection heading"
              active={editor?.isActive("heading", { level: 3 }) ?? false}
              disabled={!ready}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <Heading3 aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Bulleted list"
              active={editor?.isActive("bulletList") ?? false}
              disabled={!ready}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List aria-hidden="true" />
            </ToolbarButton>
          </div>

          <div className="rich-editor-toolbar-group" aria-label="Links and history">
            <ToolbarButton
              label={isLinkActive ? "Edit link" : "Link"}
              active={isLinkActive}
              disabled={!canCreateLink}
              onClick={() => openLinkDialog()}
              buttonRef={linkButtonRef}
            >
              <Link2 aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Undo"
              disabled={!editor?.can().chain().focus().undo().run()}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Redo"
              disabled={!editor?.can().chain().focus().redo().run()}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 aria-hidden="true" />
            </ToolbarButton>
          </div>
        </div>

        <EditorContent editor={editor} />
        {!serialized ? (
          <span className="rich-editor-placeholder" aria-hidden="true">
            {placeholder}
          </span>
        ) : null}
      </div>

      {linkPopover && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={linkPopoverRef}
              className="rich-link-popover"
              role="dialog"
              aria-label="Link destination"
              data-placement={linkPopoverPosition.placement}
              data-ready={linkPopoverPosition.ready ? "true" : "false"}
              style={{
                left: linkPopoverPosition.left,
                top: linkPopoverPosition.top,
              }}
              onMouseEnter={cancelLinkPopoverClose}
              onMouseLeave={scheduleLinkPopoverClose}
              onFocusCapture={cancelLinkPopoverClose}
              onBlurCapture={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                ) {
                  scheduleLinkPopoverClose();
                }
              }}
            >
              <span className="rich-link-popover-copy">
                <strong>
                  {popoverResource?.name ??
                    (linkPopover.href.startsWith("/")
                      ? popoverResourceLoading
                        ? "Resolving resource…"
                        : "Internal resource"
                      : "External link")}
                </strong>
                {popoverResource ? (
                  <span>
                    {popoverResource.type}
                    {popoverResource.context
                      ? ` · ${popoverResource.context}`
                      : ""}
                  </span>
                ) : null}
              </span>
              <code className="rich-link-popover-path">{linkPopover.href}</code>
              <div className="rich-link-popover-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() =>
                    openLinkDialog({
                      selection: {
                        from: linkPopover.from,
                        to: linkPopover.to,
                      },
                      href: linkPopover.href,
                    })
                  }
                >
                  Edit link
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact rich-link-popover-remove"
                  onClick={removePopoverLink}
                >
                  Remove link
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        value={serialized}
        onInput={(event) => {
          const restored = event.currentTarget.value;
          setSerialized(restored);
          if (!editor) {
            return;
          }
          try {
            const value = restored ? JSON.parse(restored) : null;
            editor.commands.setContent(
              editorDocumentFromValue(value),
              { emitUpdate: false }
            );
          } catch {
            editor.commands.setContent(editorDocumentFromValue(null), {
              emitUpdate: false,
            });
          }
        }}
      />

      {error ? (
        <p id={errorId} className="form-field-feedback form-field-error" role="alert">
          {error}
        </p>
      ) : null}

      {linkOpen ? (
        <div
          className="admin-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeLinkDialog();
            }
          }}
        >
          <div
            ref={dialogRef}
            className="admin-modal rich-link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
            onKeyDown={handleDialogKeyDown}
          >
            <h2 id={dialogTitleId} className="admin-modal-title">
              {isLinkActive ? "Edit link" : "Add link"}
            </h2>
            <p id={dialogDescriptionId} className="admin-modal-message">
              Choose a canonical public resource or enter a secure destination.
            </p>

            <label className="form-field">
              <span className="form-field-label">Find an internal resource</span>
              <span className="rich-link-search-control">
                <Search aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  className="form-input"
                  value={resourceQuery}
                  placeholder="Search Items, Recipes, Professions…"
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.target.value;
                    setResourceQuery(value);
                    setResourceResults([]);
                    setResourceStatus(
                      value.trim().length >= RESOURCE_LINK_SEARCH_MIN_LENGTH
                        ? "pending"
                        : "idle"
                    );
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowDown" &&
                      resourceResults.length > 0
                    ) {
                      event.preventDefault();
                      focusResourceResult(0);
                    }
                  }}
                />
              </span>
            </label>

            {resourceStatus === "searching" ? (
              <p className="rich-link-search-status" role="status">
                Searching…
              </p>
            ) : null}
            {resourceStatus === "error" ? (
              <p className="rich-link-search-status" role="status">
                Resource search is unavailable. Enter a path below.
              </p>
            ) : null}
            {resourceStatus === "ready" &&
            resourceQuery.trim().length >= RESOURCE_LINK_SEARCH_MIN_LENGTH &&
            resourceResults.length === 0 ? (
              <p className="rich-link-search-status" role="status">
                No matching resources
              </p>
            ) : null}
            {resourceStatus === "ready" && resourceResults.length > 0 ? (
              <div
                className="rich-link-results"
                aria-label="Internal resource results"
                aria-live="polite"
              >
                {resourceResults.map((result, index) => (
                  <button
                    ref={(button) => {
                      resultButtonRefs.current[index] = button;
                    }}
                    type="button"
                    className="rich-link-result"
                    key={`${result.type}:${result.href}`}
                    data-selected={linkHref === result.href ? "true" : undefined}
                    onClick={() => {
                      setLinkHref(result.href);
                      setLinkError(null);
                      setSelectedResource(result);
                      setResourceQuery("");
                      setResourceResults([]);
                      setResourceStatus("idle");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        focusResourceResult(
                          Math.min(index + 1, resourceResults.length - 1)
                        );
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        if (index === 0) {
                          searchInputRef.current?.focus();
                        } else {
                          focusResourceResult(index - 1);
                        }
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        focusResourceResult(0);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        focusResourceResult(resourceResults.length - 1);
                      }
                    }}
                  >
                    <span className="rich-link-result-name">{result.name}</span>
                    <span className="rich-link-result-meta">
                      {result.type}
                      {result.context ? ` · ${result.context}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedResource ? (
              <section
                className="rich-link-selected-resource"
                aria-label="Selected resource"
              >
                <span className="rich-link-selected-copy">
                  <strong>{selectedResource.name}</strong>
                  <span>
                    {selectedResource.type}
                    {selectedResource.context
                      ? ` · ${selectedResource.context}`
                      : ""}
                  </span>
                </span>
                <code>{selectedResource.href}</code>
              </section>
            ) : null}

            <label className="form-field">
              <span className="form-field-label">
                Public path or secure external URL
              </span>
              <input
                type="text"
                inputMode="url"
                className="form-input"
                value={linkHref}
                aria-invalid={linkError ? "true" : undefined}
                aria-describedby={linkError ? `${editorId}-link-error` : undefined}
                placeholder="/items/iron-bar or https://example.com"
                onChange={(event) => {
                  const value = event.target.value;
                  setLinkHref(value);
                  if (selectedResource?.href !== value.trim()) {
                    setSelectedResource(null);
                  }
                  setLinkError(null);
                }}
              />
            </label>

            {linkError ? (
              <p
                id={`${editorId}-link-error`}
                className="form-field-feedback form-field-error"
                role="alert"
              >
                {linkError}
              </p>
            ) : null}

            <div className="admin-modal-actions rich-link-dialog-actions">
              {isLinkActive ? (
                <button
                  type="button"
                  className="btn btn-secondary rich-link-unlink"
                  onClick={removeLink}
                >
                  <Unlink aria-hidden="true" />
                  Remove link
                </button>
              ) : null}
              <span className="rich-link-dialog-action-spacer" />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeLinkDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={applyLink}
              >
                Apply link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
