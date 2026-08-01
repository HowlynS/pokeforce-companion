"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { AdminSelect } from "@/components/admin/admin-select";
import {
  PUBLIC_DESIGN_CONTRACTS,
  getPublicDesignContract,
  getPublicDesignContractFixtures,
} from "@/lib/public-design/contracts";
import { getPublicDesignFixture } from "@/lib/public-design/fixtures";
import { getPublicDesignViewport } from "@/lib/public-design/viewports";

type DesignReviewWorkspaceProps = {
  initialContractId: string;
  initialFixtureKey: string;
  initialViewportId: string;
  appearanceVersion: string;
};

type ReviewExpectation = {
  id: string;
  label: string;
  detail: string;
};

export function DesignReviewWorkspace({
  initialContractId,
  initialFixtureKey,
  initialViewportId,
  appearanceVersion,
}: DesignReviewWorkspaceProps) {
  const [contractId, setContractId] = useState(initialContractId);
  const [fixtureKey, setFixtureKey] = useState(initialFixtureKey);
  const [viewportId, setViewportId] = useState(initialViewportId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  const contract =
    getPublicDesignContract(contractId) ?? PUBLIC_DESIGN_CONTRACTS[0];
  const fixtureKeys = getPublicDesignContractFixtures(contract);
  const fixture =
    getPublicDesignFixture(fixtureKey) ??
    getPublicDesignFixture(contract.representativeFixture)!;
  const viewport =
    getPublicDesignViewport(viewportId) ??
    getPublicDesignViewport(contract.viewports[0])!;

  const expectations: ReviewExpectation[] = [
      ...contract.requiredRegions.map((detail, index) => ({
        id: `required-${index}`,
        label: "Required region",
        detail,
      })),
      ...contract.optionalRegions.map((detail, index) => ({
        id: `optional-${index}`,
        label: "Hide-empty region",
        detail,
      })),
      { id: "image", label: "Image / fallback", detail: contract.imageRequirement },
      { id: "rich-text", label: "Rich text", detail: contract.richTextRequirement },
      {
        id: "appearance",
        label: "Appearance",
        detail:
          contract.scenicVariant === "none"
            ? "No public scenic variant is expected."
            : `${contract.scenicVariant} scenic variant uses the published Appearance resolver.`,
      },
      { id: "responsive", label: "Responsive", detail: viewport.expectedLayout },
      ...contract.interactions.map((detail, index) => ({
        id: `interaction-${index}`,
        label: "Interaction",
        detail,
      })),
      ...contract.accessibility.map((detail, index) => ({
        id: `accessibility-${index}`,
        label: "Accessibility",
        detail,
      })),
    ];

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const updateScale = () => {
      const available = Math.max(1, element.clientWidth - 32);
      setScale(Math.min(1, available / viewport.width));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewport.width]);

  useEffect(() => {
    const query = new URLSearchParams({
      contract: contract.id,
      fixture: fixture.key,
      viewport: viewport.id,
    });
    window.history.replaceState(null, "", `/admin/design-review?${query}`);
  }, [contract.id, fixture.key, viewport.id]);

  function selectContract(value: string) {
    const next = getPublicDesignContract(value);
    if (!next) return;
    setContractId(next.id);
    setFixtureKey(next.representativeFixture);
    setViewportId(next.viewports[0]);
    setChecked(new Set());
    setLoading(true);
    setPreviewError(false);
  }

  function selectFixture(value: string) {
    if (!(fixtureKeys as readonly string[]).includes(value)) return;
    setFixtureKey(value);
    setChecked(new Set());
    setLoading(true);
    setPreviewError(false);
  }

  function selectViewport(value: string) {
    if (!(contract.viewports as readonly string[]).includes(value)) return;
    setViewportId(value);
    setChecked(new Set());
    setLoading(true);
    setPreviewError(false);
  }

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(new URL(fixture.path, window.location.origin).href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function refreshPreview() {
    setLoading(true);
    setPreviewError(false);
    setRefreshKey((value) => value + 1);
  }

  const scalePercent = Math.round(scale * 100);

  return (
    <div className="design-review-workspace">
      <section className="design-review-controls" aria-labelledby="design-review-controls-title">
        <div className="design-review-section-heading">
          <div>
            <p className="admin-editor-eyebrow">Review target</p>
            <h2 id="design-review-controls-title">Contract and state</h2>
          </div>
          <span className="design-review-readonly-badge">Read only</span>
        </div>
        <div className="design-review-control-grid">
          <label>
            <span>Page contract</span>
            <AdminSelect
              name="designReviewContract"
              value={contract.id}
              onValueChange={selectContract}
              options={PUBLIC_DESIGN_CONTRACTS.map(({ id, label }) => ({ value: id, label }))}
            />
          </label>
          <label>
            <span>Fixture state</span>
            <AdminSelect
              name="designReviewFixture"
              value={fixture.key}
              onValueChange={selectFixture}
              options={fixtureKeys.map((key) => {
                const option = getPublicDesignFixture(key)!;
                return { value: option.key, label: option.label };
              })}
            />
          </label>
          <label>
            <span>Logical viewport</span>
            <AdminSelect
              name="designReviewViewport"
              value={viewport.id}
              onValueChange={selectViewport}
              options={contract.viewports.map((id) => {
                const option = getPublicDesignViewport(id)!;
                return { value: option.id, label: `${option.label} · ${option.width}×${option.height}` };
              })}
            />
          </label>
        </div>
        <dl className="design-review-selection-meta">
          <div><dt>Route</dt><dd>{fixture.path}</dd></div>
          <div><dt>Appearance</dt><dd>{contract.scenicVariant === "none" ? "No scenic variant" : `${contract.scenicVariant} scenic · version ${appearanceVersion}`}</dd></div>
          <div><dt>Fixture focus</dt><dd>{fixture.states.join(" · ")}</dd></div>
        </dl>
      </section>

      <div className="design-review-main-grid">
        <section className="design-review-preview-panel" aria-labelledby="design-review-preview-title">
          <header className="design-review-preview-toolbar">
            <div>
              <p className="admin-editor-eyebrow">Live public rendering</p>
              <h2 id="design-review-preview-title">{contract.label}</h2>
              <p>{viewport.width}×{viewport.height} · {scalePercent}% scale</p>
            </div>
            <div className="design-review-preview-actions">
              <button type="button" className="btn btn-secondary btn-compact" onClick={refreshPreview}>
                <RefreshCw aria-hidden="true" /> Refresh
              </button>
              <button type="button" className="btn btn-secondary btn-compact" onClick={copyPublicUrl}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Copied" : "Copy URL"}
              </button>
              <a className="btn btn-primary btn-compact" href={fixture.path} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" /> Open externally
              </a>
            </div>
          </header>

          <div className="design-review-preview-stage" ref={stageRef} data-loading={loading}>
            {loading ? <p className="design-review-preview-status" role="status">Loading public preview…</p> : null}
            {previewError ? (
              <div className="design-review-preview-error" role="alert">
                <strong>Preview could not be loaded.</strong>
                <span>Refresh the registered route or verify that its fixture exists.</span>
              </div>
            ) : null}
            <div
              className="design-review-preview-size"
              style={{ width: viewport.width * scale, height: viewport.height * scale }}
            >
              <iframe
                key={`${fixture.path}-${viewport.id}-${refreshKey}`}
                title={`Design review preview: ${contract.label} — ${fixture.label}`}
                src={fixture.path}
                width={viewport.width}
                height={viewport.height}
                style={{ transform: `scale(${scale})` }}
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                referrerPolicy="same-origin"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setPreviewError(true);
                }}
              />
            </div>
          </div>
        </section>

        <aside className="design-review-expectations" aria-labelledby="design-review-expectations-title">
          <div className="design-review-section-heading">
            <div>
              <p className="admin-editor-eyebrow">Acceptance evidence</p>
              <h2 id="design-review-expectations-title">Contract expectations</h2>
            </div>
            <span>{checked.size}/{expectations.length}</span>
          </div>
          <div className="design-review-checklist">
            {expectations.map((expectation) => (
              <label key={expectation.id}>
                <input
                  type="checkbox"
                  checked={checked.has(expectation.id)}
                  onChange={(event) => {
                    const next = new Set(checked);
                    if (event.target.checked) next.add(expectation.id);
                    else next.delete(expectation.id);
                    setChecked(next);
                  }}
                />
                <span><strong>{expectation.label}</strong><span>{expectation.detail}</span></span>
              </label>
            ))}
          </div>
          {contract.knownCaveats.length > 0 ? (
            <div className="design-review-caveats">
              <h3>Known caveats</h3>
              <ul>{contract.knownCaveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
            </div>
          ) : null}
          <div className="design-review-test-files">
            <h3>Focused tests</h3>
            <ul>{contract.focusedTests.map((file) => <li key={file}><code>{file}</code></li>)}</ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
