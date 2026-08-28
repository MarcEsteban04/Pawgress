"use client";

/**
 * Last-resort boundary: the root layout itself failed.
 *
 * Because it replaces the root layout, this file must define its own `html` and
 * `body` — which also means no fonts and no design tokens are loaded. Everything
 * here is inline on purpose. If this screen ever renders, something is badly
 * wrong, and it should still be readable.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#eef1f6",
          color: "#14161c",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>Acadify could not start</h1>
          <p style={{ lineHeight: 1.6, color: "#656c7a", margin: "0 0 1.5rem" }}>
            Something failed before the page could load. Nothing you have uploaded is affected.
            Reloading usually fixes it.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#99a0af",
                margin: "0 0 1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          {/* A real document reload, not a client navigation — the React tree
              that failed has to be thrown away, not re-rendered. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "9999px",
              background: "#14161c",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload Acadify
          </button>
        </div>
      </body>
    </html>
  );
}
