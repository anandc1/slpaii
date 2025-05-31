import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  classifyDocument,
  enhanceDocumentData,
} from "../../lib/documentDetector";
import { getTemplate } from "../../lib/templateModel";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Safer approach to handle data URLs
function processImageDataUrl(dataUrl: string): string {
  try {
    // Simple validation that it looks like a data URL
    if (!dataUrl.startsWith("data:")) {
      throw new Error('URL does not start with "data:" protocol');
    }

    // For OpenAI we need the entire data URL as-is if it's properly formatted
    // But if it's missing the proper MIME type, we need to fix it

    // Check if it has a proper MIME type
    if (dataUrl.startsWith("data:image/")) {
      // It's already in the correct format, return as is
      return dataUrl;
    } else {
      // Try to extract the base64 part and add the proper MIME type
      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (base64Match) {
        // It has a format but not an image format, replace with image/jpeg
        return `data:image/jpeg;base64,${base64Match[2]}`;
      }

      // Last resort - if it's just base64 data without proper formatting
      if (dataUrl.startsWith("data:base64,")) {
        const base64Data = dataUrl.substring("data:base64,".length);
        return `data:image/jpeg;base64,${base64Data}`;
      }

      throw new Error("Could not parse data URL format");
    }
  } catch (error) {
    console.error("Data URL processing error:", error);
    console.error(
      "Data URL preview (first 50 chars):",
      dataUrl.substring(0, 50) + "..."
    );
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { imageUrl, templateId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Log a small preview of the data URL for debugging
    console.log(
      "Received data URL (first 30 chars):",
      imageUrl.substring(0, 30) + "..."
    );

    // Process the image data URL
    let formattedImageUrl;
    try {
      formattedImageUrl = processImageDataUrl(imageUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error: `Invalid data URL format: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 400 }
      );
    }

    // Use OpenAI's vision capabilities to analyze the image with a more advanced prompt
    // specifically designed for assessment forms
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a specialized OCR system for speech-language pathology assessment forms.
              
1. Identify the type of assessment form in this image. This appears to be a PLS-5 (Preschool Language Scales, Fifth Edition) form.

2. Extract all handwritten information (not the pre-printed text) along with its corresponding fields. Pay specific attention to:
   - Child's information (name, sex, grade)
   - Date information (test date, birth date)
   - All scores including:
     * Raw scores (AC Raw Score, EC Raw Score)
     * Standard scores (AC Standard Score, EC Standard Score, Standard Score Total)
     * Percentile ranks
     * Confidence intervals
     * All subscores and totals
   
3. Format your response as a structured JSON object with these sections:
   - "formType": "PLS-5" or other identified assessment form type
   - "childInfo": personal information about the child (name, sex, grade)
   - "testDate": date the test was administered (YYYY-MM-DD format if possible)
   - "birthDate": child's birth date (YYYY-MM-DD format if possible)
   - "chronologicalAge": { "years": number, "months": number }
   - "scores": {
       "rawScores": all raw scores with their labels,
       "standardScores": all standard scores with their labels,
       "percentiles": all percentile ranks with their labels,
       "confidenceIntervals": all confidence intervals,
       "compositeScores": any total or composite scores
     }
   - "otherFields": any other handwritten information

Be extremely precise in extracting numerical values and maintain the exact structure of the data as it appears on the form.

Make sure that scores are properly categorized. Example of expected format:

{
  "formType": "PLS-5",
  "childInfo": {
    "name": "Harry S.",
    "sex": "M",
    "grade": "Pre-K"
  },
  "testDate": "2024-07-07",
  "birthDate": "2020-07-07",
  "chronologicalAge": {
    "years": 4,
    "months": 0
  },
  "scores": {
    "rawScores": {
      "AC Raw Score": 36,
      "EC Raw Score": 27
    },
    "standardScores": {
      "AC Standard Score": 75,
      "EC Standard Score": 62
    },
    "percentiles": {
      "AC Percentile": 5,
      "EC Percentile": 1
    },
    "confidenceIntervals": {
      "AC Confidence": "71-85",
      "EC Confidence": "59-70" 
    },
    "compositeScores": {
      "Standard Score Total": 137
    }
  }
}`,
            },
            {
              type: "image_url",
              image_url: {
                url: formattedImageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "";
    console.log("GPT Response content:", content.substring(0, 200) + "...");

    // Try to parse the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(content);

      // Log the parsed data
      console.log("Successfully parsed JSON response");

      // Use our document detector to verify the document type
      const rawText = JSON.stringify(parsedData);

      // If templateId is provided, use it to set the form type
      if (templateId) {
        // Get template info from database
        const template = await getTemplate(templateId);
        if (template) {
          parsedData.formType = template.name;
          console.log(
            `Using template: ${template.name} from templateId: ${templateId}`
          );
        }
      } else {
        // Otherwise use our classifier
        const documentClassification = classifyDocument(rawText);

        // If AI detected a document type but our classifier disagrees, use our classifier
        if (documentClassification.isDocument) {
          // Either trust the AI's detection or override with our own
          if (!parsedData.formType || documentClassification.confidence > 0.5) {
            parsedData.formType = documentClassification.documentType;
          }
        }
      }

      // Check if we have a valid form type
      const isValidDocument = !!parsedData.formType;

      // Enhance the data based on the document type
      if (isValidDocument) {
        parsedData = enhanceDocumentData(parsedData.formType, parsedData);
      }

      // Auto-split handwritten name into firstName and lastName if only name field exists
      if (
        parsedData.childInfo &&
        parsedData.childInfo.name &&
        !parsedData.childInfo.firstName &&
        !parsedData.childInfo.lastName
      ) {
        // Helper function to split name
        const splitName = (
          fullName: string
        ): { firstName: string; lastName: string } => {
          if (!fullName) return { firstName: "", lastName: "" };

          // Trim and normalize the name
          const cleanName = fullName.trim().replace(/\s+/g, " ");

          // If there are no spaces, treat as just a first name
          if (!cleanName.includes(" ")) {
            return { firstName: cleanName, lastName: "" };
          }

          // Special handling for names with periods like "Harry S."
          const nameParts = cleanName.split(" ");

          // If there are only two parts and the last one is an initial with period
          if (nameParts.length === 2 && /^[A-Z]\.$/.test(nameParts[1])) {
            return { firstName: nameParts[0], lastName: nameParts[1] };
          }

          // Standard case: last part is last name, everything before is first name
          const lastName = nameParts.pop() || "";
          const firstName = nameParts.join(" ");

          return { firstName, lastName };
        };

        const { firstName, lastName } = splitName(parsedData.childInfo.name);
        parsedData.childInfo.firstName = firstName;
        parsedData.childInfo.lastName = lastName;
      }

      // Process chronological age if it's in string format
      if (typeof parsedData.chronologicalAge === "string") {
        const ageMatch = parsedData.chronologicalAge.match(/(\d+)[-\s]*(\d+)/);
        if (ageMatch) {
          parsedData.chronologicalAge = {
            years: parseInt(ageMatch[1], 10),
            months: parseInt(ageMatch[2], 10),
          };
        } else {
          // Try to parse just years
          const yearsMatch =
            parsedData.chronologicalAge.match(/(\d+)\s*years?/i);
          const monthsMatch =
            parsedData.chronologicalAge.match(/(\d+)\s*months?/i);

          parsedData.chronologicalAge = {
            years: yearsMatch ? parseInt(yearsMatch[1], 10) : 0,
            months: monthsMatch ? parseInt(monthsMatch[1], 10) : 0,
          };
        }
      } else if (parsedData.dateInfo && parsedData.dateInfo.chronologicalAge) {
        // If chronologicalAge is under dateInfo, move it up and convert format
        const ageMatch =
          parsedData.dateInfo.chronologicalAge.match(/(\d+)[-\s]*(\d+)/);
        if (ageMatch) {
          parsedData.chronologicalAge = {
            years: parseInt(ageMatch[1], 10),
            months: parseInt(ageMatch[2], 10),
          };
        } else {
          parsedData.chronologicalAge = {
            years: 0,
            months: 0,
          };
        }
      }

      // Move test date and birth date to top level if they're in dateInfo
      if (parsedData.dateInfo) {
        if (parsedData.dateInfo.testDate && !parsedData.testDate) {
          parsedData.testDate = parsedData.dateInfo.testDate;
        }
        if (parsedData.dateInfo.birthDate && !parsedData.birthDate) {
          parsedData.birthDate = parsedData.dateInfo.birthDate;
        }
        // Remove dateInfo after extracting needed fields
        delete parsedData.dateInfo;
      }

      // Remove examinerInfo as it's redundant with providerUID
      if (parsedData.examinerInfo) {
        delete parsedData.examinerInfo;
      }

      // Ensure we have a patientInfo object mapped from childInfo
      if (parsedData.childInfo && !parsedData.patientInfo) {
        parsedData.patientInfo = {
          ...parsedData.childInfo,
        };

        // Remove age from patientInfo if it exists
        if (parsedData.patientInfo.age) {
          delete parsedData.patientInfo.age;
        }

        // Ensure firstName and lastName are set in patientInfo
        if (
          parsedData.childInfo.name &&
          (!parsedData.patientInfo.firstName ||
            !parsedData.patientInfo.lastName)
        ) {
          // Helper function to split name
          const splitName = (
            fullName: string
          ): { firstName: string; lastName: string } => {
            if (!fullName) return { firstName: "", lastName: "" };

            // Trim and normalize the name
            const cleanName = fullName.trim().replace(/\s+/g, " ");

            // If there are no spaces, treat as just a first name
            if (!cleanName.includes(" ")) {
              return { firstName: cleanName, lastName: "" };
            }

            // Special handling for names with periods like "Harry S."
            const nameParts = cleanName.split(" ");

            // If there are only two parts and the last one is an initial with period
            if (nameParts.length === 2 && /^[A-Z]\.$/.test(nameParts[1])) {
              return { firstName: nameParts[0], lastName: nameParts[1] };
            }

            // Standard case: last part is last name, everything before is first name
            const lastName = nameParts.pop() || "";
            const firstName = nameParts.join(" ");

            return { firstName, lastName };
          };

          const { firstName, lastName } = splitName(parsedData.childInfo.name);
          parsedData.patientInfo.firstName = firstName;
          parsedData.patientInfo.lastName = lastName;
        }
      }

      // Ensure the scores structure is consistent
      if (!parsedData.scores) {
        parsedData.scores = {};
      }

      // If we have a flat scores object, restructure it
      if (parsedData.scores && typeof parsedData.scores === "object") {
        const scores = parsedData.scores;

        // Ensure all necessary score categories exist
        if (!scores.rawScores) scores.rawScores = {};
        if (!scores.standardScores) scores.standardScores = {};
        if (!scores.percentiles) scores.percentiles = {};
        if (!scores.confidenceIntervals) scores.confidenceIntervals = {};
        if (!scores.compositeScores) scores.compositeScores = {};

        // Move any scores from the root level to the appropriate category
        Object.keys(scores).forEach((key) => {
          if (
            typeof scores[key] !== "object" &&
            key !== "rawScores" &&
            key !== "standardScores" &&
            key !== "percentiles" &&
            key !== "confidenceIntervals" &&
            key !== "compositeScores"
          ) {
            const keyLower = key.toLowerCase();

            if (keyLower.includes("raw")) {
              scores.rawScores[key] = scores[key];
            } else if (keyLower.includes("standard")) {
              scores.standardScores[key] = scores[key];
            } else if (
              keyLower.includes("percentile") ||
              keyLower.includes("rank")
            ) {
              scores.percentiles[key] = scores[key];
            } else if (
              keyLower.includes("confidence") ||
              keyLower.includes("interval")
            ) {
              scores.confidenceIntervals[key] = scores[key];
            } else if (
              keyLower.includes("total") ||
              keyLower.includes("composite")
            ) {
              scores.compositeScores[key] = scores[key];
            }

            // Delete the original property to avoid duplication
            delete scores[key];
          }
        });
      }

      return NextResponse.json({
        isDocument: isValidDocument,
        documentType: parsedData.formType || "Unknown",
        // documentConfidence: documentClassification.confidence || 0,
        documentConfidence: 0,
        data: parsedData,
        rawText: content, // Include the raw text in case parsing fails on the client side
      });
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      // If JSON parsing fails, return the raw text
      return NextResponse.json({
        isDocument: content.includes("formType"),
        documentType: "Unknown",
        data: null,
        rawText: content,
      });
    }
  } catch (error) {
    console.error("Document detection error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process image",
      },
      { status: 500 }
    );
  }
}
