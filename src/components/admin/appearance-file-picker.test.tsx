import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppearanceFilePicker } from "@/components/admin/appearance-file-picker";

function renderPicker(fileName: string | null = null) {
  return renderToStaticMarkup(
    <AppearanceFilePicker
      id="headerLogo-file"
      name="headerLogoFile"
      accept="image/png,image/jpeg,image/webp"
      fileName={fileName}
      inputRef={createRef<HTMLInputElement>()}
      describedBy="headerLogo-error"
      onChange={vi.fn()}
    />
  );
}

describe("AppearanceFilePicker", () => {
  it("keeps one visually hidden native file input in the submitted form", () => {
    const html = renderPicker();

    expect(html).toContain('type="file"');
    expect(html).toContain('name="headerLogoFile"');
    expect(html).toContain('class="appearance-file-native"');
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toContain('aria-describedby="headerLogo-error"');
  });

  it("uses one keyboard-native Choose file button with no localized browser copy", () => {
    const html = renderPicker();

    expect(html).toMatch(/<button[^>]*type="button"[^>]*>/);
    expect(html).toContain("Choose file");
    expect(html).not.toContain("Upload custom");
    expect(html).not.toContain("Choisir un fichier");
  });

  it("shows an explicit empty state and then the selected filename", () => {
    expect(renderPicker()).toContain("No file selected");
    expect(renderPicker("new-logo.webp")).toContain("new-logo.webp");
  });
});
