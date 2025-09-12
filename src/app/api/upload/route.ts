// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import { Readable } from "stream";


export const runtime = "nodejs";


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
  try {
    switch (true) {
      
      case file.type === "application/pdf": {
        const data = await pdfParse(buffer);
        return data.text || "";
      }

  
      case file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx"): {
        const { value: text } = await mammoth.extractRawText({ buffer });
        return text || "";
      }

      case file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "text/csv" ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".csv"): {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        return workbook.SheetNames.map((sheetName) =>
          XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
        ).join("\n");
      }

 
      case file.type.startsWith("image/"): {
        const {
          data: { text },
        } = await Tesseract.recognize(buffer, "eng", {
          logger: () => {}, 
        });
        return text || "";
      }

      default:
        return "";
    }
  } catch (err) {
    console.error("❌ extractTextFromFile failed:", err);
    return "";
  }
}


async function uploadToCloudinary(
  buffer: Buffer
): Promise<{ url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "uploads" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }


    const buffer = Buffer.from(await file.arrayBuffer());


    const extractedText = await extractTextFromFile(file, buffer);


    const { url: fileUrl } = await uploadToCloudinary(buffer);


    let aiSummary: string | null = null;
    try {
      if (extractedText?.trim().length > 5) {
        const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
        if (keyBase64) {
          const decodedKey = Buffer.from(keyBase64, "base64").toString("utf-8");
          const credentials = JSON.parse(decodedKey);

          const { google } = await import("googleapis");
          const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          });
          const token = await auth.getAccessToken();

          const prompt = `Summarize this document clearly:\n\n${extractedText}`;
          const GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

          const resp = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            aiSummary =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
          }
        } else {
          console.warn("⚠️ GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not set");
        }
      }
    } catch (err) {
      console.warn("⚠️ AI summary failed:", err);
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType: file.type,
      fileUrl,
      extracted_text: extractedText || null,
      ai_summary: aiSummary,
    });
  } catch (err: unknown) {
    console.error("❌ Upload API error:", err);
    return NextResponse.json(
      { success: false, message: (err as Error).message || "Upload failed" },
      { status: 500 }
    );
  }
}
