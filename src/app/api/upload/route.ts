import { NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { google } from "googleapis";

// --- Configuration ---
export const runtime = "nodejs";

// Configure Cloudinary with your account details from environment variables.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// The modern API endpoint for Google's Gemini model.
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;


// --- Helper Functions: Breaking the work into small jobs ---

/**
 * Job #1: Uploads a file's data to Cloudinary.
 * @param buffer The raw data of the file.
 * @returns The successful upload details from Cloudinary.
 */
async function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" }, // Let Cloudinary figure out the file type.
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Job #2: Reads a file and extracts all the text from it.
 * @param file The file object from the form data.
 * @param buffer The raw data of the file.
 * @returns The extracted text as a string.
 */
async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
  const { type } = file;

  // Handle PDF files
  if (type === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  // Handle Image files using OCR (Optical Character Recognition)
  if (type.startsWith("image/")) {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(buffer, "eng");
    return data.text;
  }
  
  // Handle simple text files
  if (type.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  // Fallback for unsupported file types
  return "Text extraction not supported for this file type.";
}


/**
 * Job #3: Asks the Gemini AI to explain the provided text.
 * @param text The text extracted from the document.
 * @returns The AI's explanation.
 */
async function askGeminiForExplanation(text: string): Promise<string> {
  // If there's no text, no need to call the AI.
  if (!text || text.startsWith("Text extraction not supported")) {
    return "Could not generate an explanation because no text was found.";
  }
  
  // --- First, get a secure access token from Google ---
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Google Service Account JSON key is not set in environment variables.");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const authToken = await auth.getAccessToken();

  // --- Now, call the Gemini API ---
  const prompt = `You are an expert assistant. Please explain the contents of this document in simple, clear language. Highlight any key points.\n\nDocument Text:\n${text}`;
  
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Gemini API error: ${errorDetails}`);
  }

  const responseData = await response.json();
  // Navigate through the modern Gemini API response structure.
  return responseData.candidates?.[0]?.content?.parts?.[0]?.text || "The AI did not provide an explanation.";
}


// --- Main API Route Handler ---

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // --- Process Concurrently ---
    // To save time, we'll upload the file and extract its text at the same time.
    const [uploadDetails, extractedText] = await Promise.all([
      uploadToCloudinary(fileBuffer),
      extractTextFromFile(file, fileBuffer),
    ]);

    if (!uploadDetails?.secure_url) {
      throw new Error("Cloudinary upload failed to return a URL.");
    }
    
    // --- Get AI Explanation (Sequential) ---
    // Now that we have the text, we can ask Gemini to explain it.
    const aiExplanation = await askGeminiForExplanation(extractedText);

    // --- Success! Send the results back. ---
    return NextResponse.json({
      file_url: uploadDetails.secure_url,
      extracted_text: extractedText,
      ai_summary: aiExplanation,
    });

  } catch (err: unknown) {
    console.error("An error occurred in the upload route:", err);
    const errorMessage = err instanceof Error ? err.message : "An unknown server error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

