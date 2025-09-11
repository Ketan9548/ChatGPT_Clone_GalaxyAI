import { NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { google } from "googleapis";

// Runtime required for Node.js APIs
export const runtime = "nodejs";

// --- Cloudinary config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Gemini API URL
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;

// --- Upload file to Cloudinary ---
async function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    );
    uploadStream.end(buffer);
  });
}

// --- Extract text from file ---
async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
  if (file.type === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (file.type.startsWith("image/")) {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(buffer, "eng");
    return data.text;
  }

  if (file.type.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  return "Text extraction not supported for this file type.";
}

// --- Get AI explanation from Gemini ---
async function askGeminiForExplanation(text: string): Promise<string> {
  if (!text || text.startsWith("Text extraction not supported")) {
    return "Could not generate an explanation because no text was found.";
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Google Service Account JSON key is not set in .env");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const authToken = (await auth.getAccessToken())?.token;
  if (!authToken) throw new Error("Failed to get Google Auth token");

  const prompt = `You are an expert assistant. Explain the following document in simple, clear language:\n\n${text}`;

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI did not provide an explanation.";
}

// --- Main route handler ---
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // --- Upload and extract text concurrently ---
    const [uploadDetails, extractedText] = await Promise.all([
      uploadToCloudinary(buffer),
      extractTextFromFile(file, buffer),
    ]);

    if (!uploadDetails?.secure_url) {
      throw new Error("Cloudinary upload failed to return a URL");
    }

    // --- Get AI explanation ---
    const aiExplanation = await askGeminiForExplanation(extractedText);

    return NextResponse.json({
      file_url: uploadDetails.secure_url,
      extracted_text: extractedText,
      ai_summary: aiExplanation,
    });
  } catch (err: unknown) {
    console.error("Upload route error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
