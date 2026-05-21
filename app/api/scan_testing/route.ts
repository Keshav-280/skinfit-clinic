import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    
    // Create a clean FormData with only 'image' to match test_local.ipynb (which takes a single image)
    const pythonFd = new FormData();
    // Default to centre file, or fall back to whatever was provided
    const imageFile = fd.get("centre") || fd.get("smiling");
    if (imageFile) {
        pythonFd.append("image", imageFile);
    }

    const baseUrl =
      process.env.FACE_ANALYSIS_SERVICE_URL?.trim() ||
      "https://sagnik1d-skinfit-space-api.hf.space";
    const apiUrl = `${baseUrl.replace(/\/$/, "")}/analyze_test_local`;
    
    const headers: HeadersInit = {};
    if (process.env.FACE_ANALYSIS_SERVICE_SECRET) {
      headers["X-API-Key"] = process.env.FACE_ANALYSIS_SERVICE_SECRET;
    }
    
    // Send to Python API
    const response = await fetch(apiUrl, {
      method: "POST",
      body: pythonFd,
      headers,
    });
    
    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `API Error: ${response.status} ${errText}` }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("Scan testing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
