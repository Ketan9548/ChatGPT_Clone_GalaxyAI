// pages/api/upload.ts (or your chosen route)

import { NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { google } from "googleapis";
import mammoth from "mammoth"; // for .docx files
import * as XLSX from "xlsx"; // for excel/csv
import * as cheerio from "cheerio"; // for html

// Runtime required for Node.js APIs
export const runtime = "nodejs";

// --- Cloudinary config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Gemini API URL
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

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
// Note: The 'file' parameter is now an object with type and name properties
async function extractTextFromFile(
  file: { type: string; name: string },
  buffer: Buffer
): Promise<string> {
  // PDF
  if (file.type === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  // Images (OCR)
  if (file.type.startsWith("image/")) {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(buffer, "eng");
    return data.text;
  }

  // Web pages (HTML)
  if (file.type.startsWith("text/html")) {
    const $ = cheerio.load(buffer.toString());
    $("script, style").remove(); // Remove script and style tags for cleaner text
    return $("body").text().replace(/\s\s+/g, " ").trim();
  }

  // Plain text
  if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  // Word documents
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }

  // Excel/CSV
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "text/csv" ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".xlsx")
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_csv(sheet) + "\n";
    });
    return text;
  }

  return "Text extraction not supported for this file type.";
}

// --- Get AI explanation from Gemini ---
async function askGeminiForExplanation(text: string): Promise<string> {
  if (!text || text.startsWith("Text extraction not supported")) {
    return "Could not generate an explanation because no text was found or the file type is not supported.";
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Google Service Account JSON key is not set in .env");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const authToken = await auth.getAccessToken();
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
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "AI did not provide an explanation."
  );
}

// --- Main route handler ---
export async function POST(req: Request) {
  try {
    let fileInfo: { name: string; type: string };
    let buffer: Buffer;

    const contentType = req.headers.get("content-type") || "";

    // --- Case 1: Handle URL input from a JSON body ---
    if (contentType.includes("application/json")) {
      const { url } = await req.json();
      if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "A 'url' string is required in the JSON body" }, { status: 400 });
      }

      const fileResponse = await fetch(url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from URL: ${fileResponse.statusText}`);
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileInfo = {
        name: new URL(url).pathname.split("/").pop() || "file", // Extract file name from URL
        type: fileResponse.headers.get("content-type") || "application/octet-stream",
      };
    
    // --- Case 2: Handle direct file upload ---
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      
      buffer = Buffer.from(await file.arrayBuffer());
      fileInfo = { name: file.name, type: file.type };

    } else {
        return NextResponse.json({ error: "Unsupported Content-Type. Use 'application/json' for URLs or 'multipart/form-data' for file uploads." }, { status: 415 });
    }

    // --- Process the file buffer concurrently ---
    const [uploadDetails, extractedText] = await Promise.all([
      uploadToCloudinary(buffer),
      extractTextFromFile(fileInfo, buffer),
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
    const errorMessage =
      err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}