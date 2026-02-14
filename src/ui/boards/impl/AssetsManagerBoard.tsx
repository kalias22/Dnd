import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

type GeneralAssetPreview = {
  id: string;
  name: string;
  url: string;
};

const sectionStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  background: "rgba(10, 13, 20, 0.75)",
  padding: 8,
  display: "grid",
  gap: 8,
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(142, 157, 182, 0.55)",
  borderRadius: 7,
  background: "rgba(21, 27, 39, 0.95)",
  color: "#f2f6ff",
  fontSize: 12,
  padding: "7px 10px",
  cursor: "pointer",
};

const tileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  maxHeight: 320,
  overflowY: "auto",
};

const assetCardStyle: CSSProperties = {
  border: "1px solid rgba(170, 184, 210, 0.35)",
  borderRadius: 7,
  background: "rgba(16,20,28,0.92)",
  padding: 6,
  display: "grid",
  gap: 4,
};

export default function AssetsManagerBoard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<GeneralAssetPreview[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const asset of assets) {
        URL.revokeObjectURL(asset.url);
      }
    };
  }, [assets]);

  const onImportClick = () => {
    inputRef.current?.click();
  };

  const onImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setErrorText(null);
    const imported: GeneralAssetPreview[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setAssets((previous) => [...previous, ...imported]);
  };

  const clearAssets = () => {
    for (const asset of assets) {
      URL.revokeObjectURL(asset.url);
    }
    setAssets([]);
    setErrorText(null);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onImportChange} />

      <section style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>General Assets</div>
        <div style={{ fontSize: 12, color: "#c8d2e6" }}>
          Import general images and preview them here.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={onImportClick}>
            Import Assets...
          </button>
          <button type="button" style={buttonStyle} onClick={clearAssets} disabled={assets.length === 0}>
            Clear List
          </button>
        </div>
      </section>

      {errorText && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{errorText}</div>}

      <section style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Imported Assets Preview</div>
        {assets.length === 0 ? (
          <div style={{ fontSize: 12, color: "#c8d2e6" }}>No general assets imported yet.</div>
        ) : (
          <div style={tileGridStyle}>
            {assets.map((asset) => (
              <div key={asset.id} style={assetCardStyle}>
                <img
                  src={asset.url}
                  alt={asset.name}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.16)",
                  }}
                />
                <span
                  title={asset.name}
                  style={{
                    fontSize: 11,
                    color: "#dde5f4",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {asset.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
