"use client";
// global-error is a React error boundary — must be a Client Component.
// It replaces the ENTIRE root layout when the root layout itself fails to
// render, so it must define its own <html>/<body> and cannot assume any
// styling from layout.tsx or globals.css has loaded (that's genuinely
// uncertain for this special entrypoint). Brand colors and type are inlined
// via a <style> tag rather than Tailwind classes so this never renders as
// Next's unbranded default error screen. The lucide icon is safe to use as
// its own color comes from an inline `style` prop, not a CSS class.
import { useEffect } from "react";
import { Radar } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Signal lost — Scout</title>
        <style>{`
          .ge-body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f1ecdf;
            color: #1c2b36;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            text-align: center;
          }
          .ge-card {
            display: flex;
            max-width: 420px;
            flex-direction: column;
            align-items: center;
          }
          .ge-heading {
            margin: 16px 0 0;
            font-size: 34px;
            font-weight: 800;
            letter-spacing: 0.01em;
            text-transform: uppercase;
            line-height: 0.95;
            color: #1c2b36;
          }
          .ge-copy {
            margin: 12px 0 0;
            max-width: 320px;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(28, 43, 54, 0.75);
          }
          .ge-actions {
            margin-top: 24px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 16px;
          }
          .ge-btn {
            display: inline-block;
            border: none;
            border-radius: 8px;
            background: #c73d26;
            color: #fff;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.02em;
            padding: 10px 18px;
            cursor: pointer;
            transition: background-color 0.15s ease;
          }
          .ge-btn:hover {
            background: #e1492f;
          }
          .ge-link {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #2f6f69;
            text-decoration: none;
          }
          .ge-link:hover {
            text-decoration: underline;
            text-underline-offset: 2px;
          }
        `}</style>
      </head>
      <body className="ge-body">
        <div className="ge-card">
          <Radar style={{ color: "#e1492f" }} width={40} height={40} aria-hidden />
          <h1 className="ge-heading">Signal lost.</h1>
          <p className="ge-copy">
            Something broke on our end, not yours. Try again, or head back to
            Explore.
          </p>
          <div className="ge-actions">
            <button type="button" className="ge-btn" onClick={() => reset()}>
              Try again
            </button>
            <a className="ge-link" href="/">
              Back to Explore →
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
