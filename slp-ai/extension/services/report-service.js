// Report Service for generating and managing reports
class ReportService {
  // Report sections configuration
  static reportSections = [
    {
      id: "header",
      title: "Header",
      description: "Report header with school district information",
      type: "text"
    },
    {
      id: "studentInfo",
      title: "Student Information",
      description: "Student, school, teacher, and SLP information",
      type: "text"
    },
    {
      id: "reason",
      title: "Reason for Referral",
      description: "Why the patient was referred for evaluation",
      type: "text"
    },
    {
      id: "background",
      title: "Background Information",
      description: "Summary of patient history and background",
      type: "text"
    },
    {
      id: "behavioral",
      title: "Behavioral Observations",
      description: "Observations gathered by the SLP",
      type: "text"
    },
    {
      id: "screeningResults",
      title: "Screening Results",
      description: "Results of various screenings",
      type: "table",
      tableData: {
        headers: ["Screening Type", "Date", "Results"],
        rows: [
          { id: "hearing", name: "Hearing Screening", options: ["Passed", "Not passed"] },
          { id: "oral", name: "Oral Peripheral Screening", options: ["Adequate for speech", "Abnormalities noted:"] },
          { id: "voice", name: "Voice Screening", options: ["No issues apparent", "Referred to ENT/Medical concerns"] },
          { id: "fluency", name: "Fluency Screening", options: ["Passed/WNL", "Not passed/Disfluencies noted:"] }
        ]
      }
    },
    {
      id: "assessment",
      title: "Assessment Results",
      description: "Results and interpretation of assessments",
      type: "text"
    },
    {
      id: "recommendations",
      title: "Recommendations",
      description: "Overall summary of findings and recommendations",
      type: "text"
    },
    // Additional sections can be added here later
  ];

  // Generate a complete report using OpenAI with a single prompt
  static async generateReport(patientData, soapData, assessmentData) {
    try {
      // Create a single comprehensive prompt for all sections
      const prompt = this.createComprehensivePrompt(
        patientData,
        soapData,
        assessmentData
      );

      // Get the API key
      const apiKey = await this.getOpenAIKey();

      // Prepare the request data
      const requestData = {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional speech-language pathologist assistant helping to draft clinical reports. Provide clear, concise, and professional content for each requested report section.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      };

      // Use the background script to make the API request
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            target: "openai",
            apiKey: apiKey,
            data: requestData,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!response || response.success === false) {
              reject(
                new Error(
                  response?.error || "Unknown error with OpenAI API request"
                )
              );
              return;
            }

            try {
              const content = response.data.choices[0].message.content;
              // Parse the response to extract individual sections
              const reportSections = this.parseReportSections(content);
              resolve(reportSections);
            } catch (error) {
              console.error("Error processing OpenAI response:", error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error generating report:", error);

      // Return error messages for each section
      const errorReport = {};
      this.reportSections.forEach((section) => {
        errorReport[
          section.id
        ] = `Error generating report. Please try again or edit manually. (${error.message})`;
      });

      return errorReport;
    }
  }

  // Create a comprehensive prompt for all sections
  static createComprehensivePrompt(patientData, soapData, assessmentData) {
    const { firstName, lastName, birthDate } = patientData;
    const age = this.calculateAge(birthDate);
    const { subjective, objective, assessment, plan } = soapData.data;

    // Get assessment-specific data
    const assessmentType = assessmentData.type;
    const assessmentResults = assessmentData.data.interpretation || "";
    
    // Current date for report
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a comprehensive prompt for all sections
    return `Generate a speech-language pathology evaluation report for ${firstName} ${lastName}, a ${age}-year-old patient, following the exact format below.

PATIENT INFORMATION:
- Name: ${firstName} ${lastName}
- Date of Birth: ${birthDate}
- Age: ${age}

SOAP NOTE INFORMATION:
- Subjective: ${subjective}
- Objective: ${objective}
- Assessment: ${assessment}
- Plan: ${plan}

ASSESSMENT INFORMATION:
- Assessment Type: ${assessmentType}
- Assessment Results: ${assessmentResults}

Please generate the following report sections exactly as outlined:

## HEADER
BILINGUAL SPEECH-LANGUAGE EVALUATION SUMMARY
CONFIDENTIAL

## STUDENT INFORMATION
Student: ${firstName} ${lastName}
Date of Birth: ${birthDate}
School: [Extract from notes if available]
Teacher: [Extract from notes if available]
Grade: [Extract from notes if available]
Speech-Language Pathologist: [Extract from notes if available]
Date of Evaluation: ${currentDate}

## REASON FOR REFERRAL
[Generate a concise reason for referral based on the information provided. Format as shown in the example with clear bullet points if multiple reasons exist.]

## BACKGROUND INFORMATION
[Generate comprehensive background information including grade level, referral process, and previous services. Include bullet points for ACCESS scores, ESL services, developmental/medical history, cultural-linguistic aspects, and educational history if mentioned in the notes.]

## BEHAVIORAL OBSERVATIONS
[Generate behavioral observations as gathered by the SLP during the evaluation. Include details about cooperation, attention span, and other relevant behaviors.]

## SCREENING RESULTS
[This section will be presented as a table with checkboxes in the final report - just provide the text content for each screening area: Hearing Screening, Oral Peripheral Screening, Voice Screening, and Fluency Screening.]

## ASSESSMENT RESULTS
[Generate detailed assessment results based on the provided assessment data. Include specific test names, scores, and interpretations where available.]

## RECOMMENDATIONS
[Generate clear, actionable recommendations based on the assessment results and observations. Format as numbered or bulleted list.]

Be professional, concise, and use appropriate clinical language for a school-based speech-language pathology report. Format the content to match a formal evaluation report structure.`;
  }

  // Parse the response to extract individual sections
  static parseReportSections(content) {
    const reportContent = {};

    // For each section, extract the content between its header and the next header
    this.reportSections.forEach((section, index) => {
      const sectionHeader = `## ${section.title.toUpperCase()}`;
      const nextSectionHeader =
        index < this.reportSections.length - 1
          ? `## ${this.reportSections[index + 1].title.toUpperCase()}`
          : null;

      let sectionContent = "";

      if (content.includes(sectionHeader)) {
        const startIndex =
          content.indexOf(sectionHeader) + sectionHeader.length;
        const endIndex = nextSectionHeader
          ? content.indexOf(nextSectionHeader)
          : content.length;

        sectionContent = content.substring(startIndex, endIndex).trim();
      } else {
        // Try alternative format (without ##)
        const altSectionHeader = section.title.toUpperCase();
        const altNextSectionHeader =
          index < this.reportSections.length - 1
            ? this.reportSections[index + 1].title.toUpperCase()
            : null;

        if (content.includes(altSectionHeader)) {
          const startIndex =
            content.indexOf(altSectionHeader) + altSectionHeader.length;
          const endIndex = altNextSectionHeader
            ? content.indexOf(altNextSectionHeader)
            : content.length;

          sectionContent = content.substring(startIndex, endIndex).trim();
        }
      }

      reportContent[section.id] = sectionContent;
    });

    return reportContent;
  }

  // Helper to calculate age from birthdate
  static calculateAge(birthDate) {
    if (!birthDate) return "unknown age";

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  }

  // Get OpenAI API key from storage
  static async getOpenAIKey() {
    try {
      // For development, use a default key if available
      if (window.openaiApiKey) {
        return window.openaiApiKey;
      }

      // For testing purposes - REMOVE IN PRODUCTION
      // This is a placeholder key format, not a real key
      return "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";

      // Uncomment this for production use with Chrome storage
      /*
      const result = await chrome.storage.sync.get(["openaiApiKey"]);
      if (!result.openaiApiKey) {
        throw new Error(
          "OpenAI API key not found. Please set it in the extension options."
        );
      }
      return result.openaiApiKey;
      */
    } catch (error) {
      console.error("Error retrieving OpenAI API key:", error);
      throw error;
    }
  }

  // Convert report to HTML format
  static convertToHTML(reportContent) {
    let html = `
      <div class="report-container">
        <div class="report-header">
          <h1>Speech-Language Pathology Report</h1>
        </div>
    `;

    // Add each section
    for (const section of this.reportSections) {
      const sectionContent = reportContent[section.id] || "";
      
      html += `
        <div class="report-section">
          <h2>${section.title}</h2>
          <div class="section-content">
      `;
      
      // Handle different section types
      if (section.type === "table" && typeof sectionContent === "object" && sectionContent.rows) {
        // Create a table for the screening results
        html += `<table border="1" cellpadding="5" cellspacing="0" width="100%">
          <thead>
            <tr>
              <th>Screening Type</th>
              <th>Date</th>
              <th>Results</th>
            </tr>
          </thead>
          <tbody>
        `;
        
        // Add each row
        sectionContent.rows.forEach(row => {
          html += `<tr>
            <td>${row.name}</td>
            <td>${row.date || ''}</td>
            <td>${row.selectedOptions.join(', ') || 'No results selected'}</td>
          </tr>`;
        });
        
        html += `</tbody></table>`;
        
        // Add notes if available
        if (sectionContent.notes) {
          html += `<p><strong>Additional Notes:</strong> ${sectionContent.notes.replace(/\n/g, '<br>')}</p>`;
        }
      } else {
        // Regular text content
        html += typeof sectionContent === 'string' ? 
          sectionContent.replace(/\n/g, "<br>") : 
          'Content not available';
      }
      
      html += `
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  // Convert HTML to Word document (simplified version)
  static downloadAsWord(html, fileName) {
    // Create a Blob with the HTML content
    const blob = new Blob(
      [
        `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>SLP Report</title>
        <style>
          body { font-family: 'Calibri', sans-serif; }
          .report-header { text-align: center; margin-bottom: 20px; }
          .report-section { margin-bottom: 15px; }
          h1 { font-size: 18pt; }
          h2 { font-size: 14pt; color: #2a5885; }
          .section-content { font-size: 11pt; line-height: 1.5; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `,
      ],
      { type: "application/msword" }
    );

    // Create download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName || "slp-report.doc";

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Make it available globally
window.ReportService = ReportService;
