"use client";

import { useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export default function TestAIPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<unknown>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch("/api/analyze-skin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image: reader.result }),
        });
        const data = await response.json();
        setAiResult(data);
      } catch (err) {
        console.error(err);
        setAiResult({ error: "Request failed" });
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex flex-col items-center pt-20">
      <h1 className="text-3xl font-bold mb-2">Skinnfit AI Sandbox</h1>
      <p className="text-zinc-400 mb-8">
        Internal testing tool for the Vision + GPT-4o pipeline.
      </p>

      <input
        type="file"
        id="sandbox-upload"
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <label
        htmlFor="sandbox-upload"
        className={`cursor-pointer bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors ${isAnalyzing ? "pointer-events-none opacity-90" : ""}`}
      >
        {isAnalyzing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <UploadCloud className="h-5 w-5" />
        )}
        {isAnalyzing ? "Analyzing Clinical Data..." : "Upload Test Image"}
      </label>

      {aiResult != null ? (
        <div className="mt-8 w-full max-w-3xl bg-black rounded-xl border border-zinc-800 p-4 overflow-x-auto">
          <pre className="text-green-400 text-sm font-mono">
            {JSON.stringify(aiResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
