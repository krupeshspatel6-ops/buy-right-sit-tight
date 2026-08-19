import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Buy Right Sit Tight — a live book by Krupesh Patel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The social share card. Half-painted wall on the left (the motif), title +
// author on the right — so a link posted to X or Substack looks like a book.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#faf7f0",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* painted band */}
        <div
          style={{
            width: 300,
            height: "100%",
            background: "linear-gradient(90deg, #7fa3d1 0%, #7fa3d1 78%, #8db0da 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 70px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#1e5fbf",
              fontSize: 24,
              textTransform: "uppercase",
              letterSpacing: 4,
              fontWeight: 700,
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#1e5fbf" }} />
            LIVE · A BOOK IN 100 CHAPTERS
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 88,
              fontWeight: 700,
              color: "#26241f",
              lineHeight: 1.05,
              marginTop: 20,
            }}
          >
            <span>Buy Right</span>
            <span>Sit Tight</span>
          </div>
          <div style={{ fontSize: 34, fontStyle: "italic", color: "#6b675d", marginTop: 20 }}>
            watch the paint dry.
          </div>
          <div style={{ fontSize: 26, color: "#6b675d", marginTop: 40 }}>
            A 15-year-old learning to invest in public — with his own money.
          </div>
          <div style={{ fontSize: 24, color: "#26241f", marginTop: 12, fontWeight: 700 }}>
            being written by Krupesh Patel
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
