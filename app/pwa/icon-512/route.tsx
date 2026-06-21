import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#DC2626",
          borderRadius: 96,
        }}
      >
        <svg
          width="320"
          height="320"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FBBF24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="8.5" rx="6" ry="5" />
          <path d="M6 8.5h12" />
          <path d="M12 3.5v10" />
          <path d="M9 6h6" />
          <path d="M9 11h6" />
          <path d="M12 13.5v8.5" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
