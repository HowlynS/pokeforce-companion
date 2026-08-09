"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Grip, Monitor, RotateCcw, Smartphone } from "lucide-react";
import {
  APPEARANCE_ASSET_DRAFT_EVENT,
  APPEARANCE_RESET_DRAFT_EVENT,
  APPEARANCE_RESTORE_DEFAULTS_EVENT,
} from "@/components/admin/appearance-asset-field";
import {
  clampAppearancePercentage,
  type ResolvedSiteAppearance,
  type ScenicPosition,
} from "@/lib/appearance/defaults";
import {
  positionFromPointerDrag,
  serializeScenicPosition,
} from "@/lib/appearance/position";
import { dispatchFormChange } from "@/lib/admin/form-change-event";

type PublicSurface = "home" | "catalogue" | "itemDetail";
type Surface = PublicSurface | "admin";
type Device = "desktop" | "ultrawide" | "mobile";
type PositionDevice = "desktop" | "mobile";

const SURFACES: readonly { value: Surface; label: string }[] = [
  { value: "home", label: "Homepage" },
  { value: "catalogue", label: "Items catalogue" },
  { value: "itemDetail", label: "Item detail" },
  { value: "admin", label: "Admin workspace" },
];

const DEVICES: readonly {
  value: Device;
  label: string;
  width: number;
  height: number;
}[] = [
  { value: "desktop", label: "Desktop", width: 1920, height: 1080 },
  { value: "ultrawide", label: "Ultrawide", width: 3440, height: 1440 },
  { value: "mobile", label: "Mobile", width: 390, height: 844 },
];

const SURFACE_FORM_PREFIX: Record<PublicSurface, string> = {
  home: "home",
  catalogue: "catalogue",
  itemDetail: "itemDetail",
};

type PositionDraft = Record<
  PublicSurface,
  { desktop: ScenicPosition; mobile: ScenicPosition }
>;

type AssetDraft = {
  headerLogo: string | null;
  favicon: string | null;
  homeBackground: string | null;
  catalogueBackground: string | null;
  itemDetailBackground: string | null;
  adminBackground: string | null;
};

function positionDraft(appearance: ResolvedSiteAppearance): PositionDraft {
  return {
    home: {
      desktop: { ...appearance.home.desktop },
      mobile: { ...appearance.home.mobile },
    },
    catalogue: {
      desktop: { ...appearance.catalogue.desktop },
      mobile: { ...appearance.catalogue.mobile },
    },
    itemDetail: {
      desktop: { ...appearance.itemDetail.desktop },
      mobile: { ...appearance.itemDetail.mobile },
    },
  };
}

function assetDraft(appearance: ResolvedSiteAppearance): AssetDraft {
  return {
    headerLogo: appearance.headerLogo.url,
    favicon: appearance.favicon.url,
    homeBackground: appearance.home.background.url,
    catalogueBackground: appearance.catalogue.background.url,
    itemDetailBackground: appearance.itemDetail.background.url,
    adminBackground: appearance.admin.background.url,
  };
}

export function AppearanceLivePreview({
  published,
  defaults,
}: {
  published: ResolvedSiteAppearance;
  defaults: ResolvedSiteAppearance;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const formSignalRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: ScenicPosition;
    width: number;
    height: number;
  } | null>(null);
  const [surface, setSurface] = useState<Surface>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const [availableWidth, setAvailableWidth] = useState(0);
  const [positions, setPositions] = useState(() => positionDraft(published));
  const [adminPosition, setAdminPosition] = useState(() => ({
    ...published.admin.desktop,
  }));
  const [assets, setAssets] = useState(() => assetDraft(published));
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    setAvailableWidth(stage.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onAssetDraft = (event: Event) => {
      const detail = (event as CustomEvent<{ name: keyof AssetDraft; url: string | null }>).detail;
      if (!detail || !(detail.name in assets)) {
        return;
      }
      setAssets((current) => ({ ...current, [detail.name]: detail.url }));
    };
    const onRestore = () => {
      setPositions(positionDraft(defaults));
      setAdminPosition({ ...defaults.admin.desktop });
      setAssets(assetDraft(defaults));
    };
    const onReset = () => {
      setPositions(positionDraft(published));
      setAdminPosition({ ...published.admin.desktop });
      setAssets(assetDraft(published));
    };
    window.addEventListener(APPEARANCE_ASSET_DRAFT_EVENT, onAssetDraft);
    window.addEventListener(APPEARANCE_RESTORE_DEFAULTS_EVENT, onRestore);
    window.addEventListener(APPEARANCE_RESET_DRAFT_EVENT, onReset);
    return () => {
      window.removeEventListener(APPEARANCE_ASSET_DRAFT_EVENT, onAssetDraft);
      window.removeEventListener(APPEARANCE_RESTORE_DEFAULTS_EVENT, onRestore);
      window.removeEventListener(APPEARANCE_RESET_DRAFT_EVENT, onReset);
    };
  }, [assets, defaults, published]);

  const target = DEVICES.find((preset) => preset.value === device) ?? DEVICES[0];
  const scale = availableWidth > 0 ? Math.min(1, availableWidth / target.width) : 0;
  const positionDevice: PositionDevice = device === "mobile" ? "mobile" : "desktop";
  const activePosition =
    surface === "admin"
      ? adminPosition
      : positions[surface][positionDevice];
  const scenicAssetName =
    surface === "admin"
      ? "adminBackground"
      : surface === "home"
      ? "homeBackground"
      : surface === "catalogue"
        ? "catalogueBackground"
        : "itemDetailBackground";
  const scenicUrl = assets[scenicAssetName];

  const positionFields = useMemo(
    () =>
      (Object.entries(positions) as [
        PublicSurface,
        PositionDraft[PublicSurface],
      ][]).flatMap(
        ([surfaceName, devicePositions]) =>
          (["desktop", "mobile"] as const).flatMap((deviceName) =>
            (["x", "y"] as const).map((axis) => ({
              surface: surfaceName,
              device: deviceName,
              axis,
              name: `${SURFACE_FORM_PREFIX[surfaceName]}${
                deviceName === "desktop" ? "Desktop" : "Mobile"
              }Position${axis.toUpperCase()}`,
              value: devicePositions[deviceName][axis],
            }))
          )
      ),
    [positions]
  );

  function updatePosition(next: ScenicPosition) {
    if (surface === "admin") {
      setAdminPosition(next);
      requestAnimationFrame(() => dispatchFormChange(formSignalRef.current));
      return;
    }
    setPositions((current) => ({
      ...current,
      [surface]: {
        ...current[surface],
        [positionDevice]: next,
      },
    }));
    requestAnimationFrame(() => dispatchFormChange(formSignalRef.current));
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  return (
    <section className="appearance-live-preview" aria-labelledby="appearance-preview-title">
      <div className="appearance-preview-heading">
        <div>
          <p className="admin-editor-eyebrow">Unpublished draft</p>
          <h2 id="appearance-preview-title">Live appearance preview</h2>
          <p>
            Representative public and admin shells. Drag the canvas or enter
            exact values; nothing changes outside this draft until Save.
          </p>
        </div>
        <div className="appearance-preview-tab-icon">
          <span>Tab icon</span>
          {assets.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element -- draft may be a browser-local blob URL.
            <img src={assets.favicon} alt="Draft favicon preview" />
          ) : (
            <span aria-label="No custom favicon">—</span>
          )}
        </div>
      </div>

      <div className="appearance-preview-toolbar">
        <div role="group" aria-label="Preview page" className="appearance-segmented-control">
          {SURFACES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={surface === option.value}
              onClick={() => {
                setSurface(option.value);
                if (option.value === "admin" && device === "mobile") {
                  setDevice("desktop");
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Preview device" className="appearance-segmented-control">
          {DEVICES.filter(
            (preset) => surface !== "admin" || preset.value !== "mobile"
          ).map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={device === preset.value}
              onClick={() => setDevice(preset.value)}
            >
              {preset.value === "mobile" ? (
                <Smartphone aria-hidden="true" />
              ) : (
                <Monitor aria-hidden="true" />
              )}
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="appearance-position-controls">
        {positionFields.map((field) => {
          const active =
            surface !== "admin" &&
            field.surface === surface &&
            field.device === positionDevice;
          return active ? (
            <label key={field.name}>
              <span>{field.axis.toUpperCase()} position</span>
              <span className="appearance-number-input">
                <input
                  ref={field.axis === "x" ? formSignalRef : undefined}
                  type="number"
                  name={field.name}
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(field.value)}
                  onChange={(event) => {
                    const value = clampAppearancePercentage(
                      event.currentTarget.valueAsNumber,
                      field.value
                    );
                    updatePosition({
                      ...activePosition,
                      [field.axis]: value,
                    });
                  }}
                />
                <span>%</span>
              </span>
            </label>
          ) : (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              value={Math.round(field.value)}
            />
          );
        })}
        {(["x", "y"] as const).map((axis) =>
          surface === "admin" ? (
            <label key={axis}>
              <span>{axis.toUpperCase()} position</span>
              <span className="appearance-number-input">
                <input
                  ref={axis === "x" ? formSignalRef : undefined}
                  type="number"
                  name={`adminDesktopPosition${axis.toUpperCase()}`}
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(adminPosition[axis])}
                  onChange={(event) => {
                    const value = clampAppearancePercentage(
                      event.currentTarget.valueAsNumber,
                      adminPosition[axis]
                    );
                    updatePosition({
                      ...adminPosition,
                      [axis]: Math.round(value),
                    });
                  }}
                />
                <span>%</span>
              </span>
            </label>
          ) : (
            <input
              key={axis}
              type="hidden"
              name={`adminDesktopPosition${axis.toUpperCase()}`}
              value={Math.round(adminPosition[axis])}
            />
          )
        )}

        <div className="appearance-position-readout" aria-live="polite">
          X {Math.round(activePosition.x)}% · Y {Math.round(activePosition.y)}%
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() =>
            updatePosition(
              surface === "admin"
                ? { ...published.admin.desktop }
                : { ...positionDraft(published)[surface][positionDevice] }
            )
          }
        >
          <RotateCcw aria-hidden="true" />
          Reset to published
        </button>
        <button
          type="button"
          className="btn btn-cancel btn-compact"
          onClick={() =>
            updatePosition(
              surface === "admin"
                ? { ...defaults.admin.desktop }
                : { ...positionDraft(defaults)[surface][positionDevice] }
            )
          }
        >
          Restore default position
        </button>
      </div>

      <div
        ref={stageRef}
        className="appearance-preview-stage"
        data-ready={scale > 0 ? "true" : "false"}
        style={{ height: target.height * scale }}
      >
        {scale === 0 ? (
          <span className="appearance-preview-loading" role="status">
            Preparing preview…
          </span>
        ) : null}
        <div
          className={`appearance-preview-viewport appearance-preview-viewport--${device}`}
          style={{
            width: target.width,
            height: target.height,
            transform: `scale(${scale})`,
          }}
        >
          <div
            className={
              surface === "admin"
                ? `appearance-admin-shell-preview appearance-admin-shell-preview--${device}`
                : `public-site-shell public-site-shell--scenic public-site-shell--scenic-${
                    surface === "itemDetail" ? "detail" : surface
                  } appearance-public-preview appearance-public-preview--${device}`
            }
            style={
              surface === "admin"
                ? ({
                    "--admin-preview-background-image": scenicUrl
                      ? `url("${scenicUrl}")`
                      : "none",
                    "--admin-preview-background-position":
                      serializeScenicPosition(activePosition),
                  } as React.CSSProperties)
                : undefined
            }
          >
            {surface === "admin" ? null : (
              <div
                className={`public-scenic-background public-scenic-background--${
                  surface === "itemDetail" ? "detail" : surface
                }`}
                aria-hidden="true"
                style={{
                  "--public-scenic-image": scenicUrl
                    ? `url("${scenicUrl}")`
                    : "none",
                  "--public-scenic-position":
                    serializeScenicPosition(activePosition),
                } as React.CSSProperties}
              />
            )}

            <div
              className={
                surface === "admin"
                  ? "appearance-preview-drag-layer appearance-preview-drag-layer--admin"
                  : "appearance-preview-drag-layer"
              }
              data-dragging={dragging ? "true" : "false"}
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                dragRef.current = {
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startPosition: { ...activePosition },
                  width: rect.width,
                  height: rect.height,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) {
                  return;
                }
                updatePosition(
                  positionFromPointerDrag({
                    start: drag.startPosition,
                    deltaX: event.clientX - drag.startClientX,
                    deltaY: event.clientY - drag.startClientY,
                    width: drag.width,
                    height: drag.height,
                  })
                );
              }}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              aria-hidden="true"
            >
              <span>
                <Grip aria-hidden="true" /> Drag wallpaper
              </span>
            </div>

            {surface === "admin" ? (
              <AdminPreviewContent />
            ) : (
              <>
                <PreviewHeader logoUrl={assets.headerLogo} />
                <main className="public-site-container public-site-main">
                  <PreviewContent surface={surface} />
                </main>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="appearance-preview-dimensions">
        Target viewport: {target.width}×{target.height}
      </p>
    </section>
  );
}

function AdminPreviewContent() {
  return (
    <div className="appearance-admin-preview-frame" aria-hidden="true">
      <aside className="appearance-admin-preview-sidebar">
        <div className="appearance-admin-preview-brand">
          <strong>PokeForce Companion</strong>
          <span>Admin · View public site</span>
        </div>
        <div className="appearance-admin-preview-account">
          <span className="appearance-admin-preview-avatar" />
          <span>admin@example.com</span>
          <span className="appearance-admin-preview-signout">Sign out</span>
        </div>
        <div className="appearance-admin-preview-nav">
          <div className="appearance-admin-preview-nav-primary">
            {[
              "Dashboard",
              "Items",
              "Recipes",
              "Professions",
              "Classes",
              "Locations",
              "Shops",
            ].map((label, index) => (
              <span
                key={label}
                className={
                  index === 1 ? "appearance-admin-preview-nav-active" : undefined
                }
              >
                <i />
                {label}
              </span>
            ))}
          </div>
          <div className="appearance-admin-preview-site-group">
            <small>Site administration</small>
            <span>
              <i />
              Appearance
            </span>
          </div>
        </div>
      </aside>
      <main className="appearance-admin-preview-content">
        <header className="appearance-admin-preview-header">
          <div>
            <small>Content workspace</small>
            <h3>Record editor</h3>
            <p>Representative shared admin shell and editing surfaces.</p>
          </div>
          <span className="appearance-admin-preview-action">Save Changes</span>
        </header>
        <div className="appearance-admin-preview-workspace">
          <section className="appearance-admin-preview-records">
            <strong>Records</strong>
            <span className="appearance-admin-preview-search" />
            <span />
            <span className="is-selected" />
            <span />
            <span />
          </section>
          <section className="appearance-admin-preview-editor">
            <div className="appearance-admin-preview-panel">
              <strong>General information</strong>
              <p>Core authored details remain on an opaque working surface.</p>
              <label>
                <span>Name</span>
                <i />
              </label>
              <label>
                <span>Description</span>
                <i className="is-textarea" />
              </label>
            </div>
            <div className="appearance-admin-preview-panel appearance-admin-preview-panel--compact">
              <strong>Publishing</strong>
              <p>Shared actions stay readable over every scenic crop.</p>
            </div>
          </section>
          <aside className="appearance-admin-preview-context">
            <div className="appearance-admin-preview-panel">
              <strong>Context</strong>
              <span />
              <span />
              <span />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function PreviewHeader({ logoUrl }: { logoUrl: string | null }) {
  return (
    <header className="public-site-header">
      <div className="public-site-container public-site-header-inner">
        <span className="public-site-brand">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- draft may be a browser-local blob URL.
            <img
              src={logoUrl}
              alt="Merchants Codex"
              className="public-site-logo"
            />
          ) : (
            <span>Merchants Codex</span>
          )}
        </span>
        <nav aria-label="Preview navigation" className="public-primary-nav">
          <div className="public-primary-nav-links">
            {["Items", "Recipes", "Professions", "Classes", "World"].map(
              (label) => (
                <span key={label} className="public-nav-link">
                  {label}
                </span>
              )
            )}
          </div>
          {/* Decorative stand-in for PublicSiteSearch: the real header's
              nav renders as a 3-column grid (link row, search) via
              .public-primary-nav's display:contents, so this static
              preview needs its own third column to match — otherwise the
              grid's search column would sit empty. */}
          <span className="public-site-search" aria-hidden="true">
            <span className="public-site-search-input">Search the Codex...</span>
          </span>
        </nav>
      </div>
    </header>
  );
}

function PreviewContent({ surface }: { surface: PublicSurface }) {
  if (surface === "home") {
    return (
      <div className="landing-page">
        <section className="landing-overview">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Merchants Codex</p>
            <h1>
              The Guild&apos;s Knowledge.
              <span>Yours to Use.</span>
            </h1>
            <p className="landing-hero-description">
              A complete reference for items, recipes, locations, and the
              world&apos;s most valuable goods.
            </p>
            <div className="landing-hero-actions">
              <span className="btn btn-primary">Browse Items</span>
              <span className="btn btn-secondary">Explore Recipes</span>
            </div>
          </div>
          <dl className="landing-statistics">
            {["Items", "Recipes", "Locations", "Shops"].map((label, index) => (
              <div className="landing-statistic" key={label}>
                <dt>{label}</dt>
                <dd>{[128, 42, 18, 7][index]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }

  if (surface === "catalogue") {
    return (
      <>
        <header className="page-header">
          <h1>Items</h1>
          <p>Browse items, materials, and useful crafting resources.</p>
        </header>
        <nav className="public-filter-nav" aria-label="Preview item filters">
          <span className="public-filter-link public-filter-link--active">All</span>
          <span className="public-filter-link">Materials</span>
          <span className="public-filter-link">Tools</span>
        </nav>
        <section className="content-grid item-index-catalogue">
          {["Aetherglass", "Iron Ore", "Restorative Primer", "Tension Spool"].map(
            (name) => (
              <article className="card" key={name}>
                <div className="item-index-card-media" aria-hidden="true" />
                <h2>{name}</h2>
                <p className="item-index-card-category">Material</p>
              </article>
            )
          )}
        </section>
      </>
    );
  }

  return (
    <article className="item-detail-page">
      <nav className="public-breadcrumb" aria-label="Preview breadcrumb">
        Home / Items / Aetherglass
      </nav>
      <div className="item-content-grid">
        <div className="item-main-column">
          <section className="item-identity-panel resource-atmosphere resource-atmosphere--item">
            <div className="item-identity-stage" aria-hidden="true" />
            <div className="item-identity-copy">
              <p className="item-category-label">Material</p>
              <h1 className="public-resource-title">Aetherglass</h1>
              <p className="item-description">
                A refined crafting material recorded in the Merchants Codex.
              </p>
            </div>
          </section>
        </div>
        <aside className="item-sidebar">
          <section className="item-panel item-sidebar-panel">
            <h2>Item details</h2>
            <p>Verified reference data</p>
          </section>
        </aside>
      </div>
    </article>
  );
}
