"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
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
};

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
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
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
  const [resourceStatus, setResourceStatus] = useState<
    "idle" | "searching" | "ready" | "error"
  >("idle");

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
    onSelectionUpdate: () => setRevision((value) => value + 1),
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

  function openLinkDialog() {
    if (!editor) {
      return;
    }
    const { from, to } = editor.state.selection;
    linkSelectionRef.current = { from, to };
    setLinkHref(String(editor.getAttributes("link").href ?? ""));
    setLinkError(null);
    setResourceQuery("");
    setResourceResults([]);
    setResourceStatus("idle");
    setLinkOpen(true);
  }

  function closeLinkDialog() {
    setLinkOpen(false);
    setLinkError(null);
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
              onClick={openLinkDialog}
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
                    if (value.trim().length < RESOURCE_LINK_SEARCH_MIN_LENGTH) {
                      setResourceResults([]);
                      setResourceStatus("idle");
                    }
                  }}
                />
              </span>
            </label>

            <div
              className="rich-link-results"
              aria-live="polite"
              aria-label="Internal resource results"
            >
              {resourceStatus === "searching" ? (
                <p className="rich-link-status">Searching…</p>
              ) : null}
              {resourceStatus === "error" ? (
                <p className="rich-link-status">
                  Resource search is unavailable. Enter a path below.
                </p>
              ) : null}
              {resourceStatus === "ready" && resourceResults.length === 0 ? (
                <p className="rich-link-status">No matching public resources.</p>
              ) : null}
              {resourceResults.map((result) => (
                <button
                  type="button"
                  className="rich-link-result"
                  key={`${result.type}:${result.href}`}
                  data-selected={linkHref === result.href ? "true" : undefined}
                  onClick={() => {
                    setLinkHref(result.href);
                    setLinkError(null);
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
                  setLinkHref(event.target.value);
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
