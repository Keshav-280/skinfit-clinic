import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const pythonFd = new FormData();
    const centre = fd.get("centre");
    const smiling = fd.get("smiling");

    if (centre instanceof Blob) {
      pythonFd.append("image", centre, "centre.jpg");
    } else if (smiling instanceof Blob) {
      pythonFd.append("image", smiling, "smiling.jpg");
    } else {
      return NextResponse.json({ error: "Provide centre and/or smiling image." }, { status: 400 });
    }

    if (smiling instanceof Blob) {
      pythonFd.append("smiling", smiling, "smiling.jpg");
    }

    const baseUrl =
      process.env.FACE_ANALYSIS_SERVICE_URL?.trim() ||
      "https://sagnik1d-skinfit-space-api.hf.space";
    const apiUrl = `${baseUrl.replace(/\/$/, "")}/analyze_test_local`;

    const headers: HeadersInit = {};
    if (process.env.FACE_ANALYSIS_SERVICE_SECRET) {
      headers["X-API-Key"] = process.env.FACE_ANALYSIS_SERVICE_SECRET;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      body: pythonFd,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `API Error: ${response.status} ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Scan testing error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
