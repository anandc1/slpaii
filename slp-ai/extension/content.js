//const OpenAIService = chrome.runtime.getURL('services/openai-service.js');

let button = null;
let sidebar = null;
let isOpen = false;
let isEnabled = true;

// Utility functions
function cleanText(text) {
  return text?.trim().replace(/\s+/g, " ").replace(/\n+/g, " ").trim() || "";
}

function createOverlayButton() {
  const button = document.createElement("button");
  button.className = "slp-ai-overlay-button";
  button.style.display = "none"; // Hidden by default
  button.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
    </svg>
  `;

  document.body.appendChild(button);
  return button;
}

function createSidebar() {
  const sidebar = document.createElement("div");
  sidebar.className = "slp-ai-sidebar";

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>AI Assistant</h2>
      <button class="close-btn">×</button>
    </div>
    <div class="sidebar-content">
      <div class="input-section">
        <textarea 
          placeholder="Enter your prompt here..."
          class="prompt-textarea"
        ></textarea>
        <button class="generate-btn">
          Generate Response
          <span class="loading-spinner hidden"></span>
        </button>
      </div>
      <div class="response-section hidden">
        <div class="response-content"></div>
        <button class="copy-btn">
          Copy Response
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(sidebar);
  setupSidebarHandlers(sidebar);
  return sidebar;
}

function getInputType(element) {
  // Check for contenteditable
  if (element.hasAttribute("contenteditable")) {
    return "contenteditable";
  }

  // Check for specific input types
  if (element.tagName === "INPUT") {
    // Get the input type or default to 'text'
    const inputType = element.getAttribute("type") || "text";
    return inputType.toLowerCase();
  }

  // Check for textarea
  if (element.tagName === "TEXTAREA") {
    return "textarea";
  }

  // Check for select
  if (element.tagName === "SELECT") {
    return "select";
  }

  // Check for role="textbox"
  if (element.getAttribute("role") === "textbox") {
    return "textbox";
  }

  // Check if element is editable
  if (element.isContentEditable) {
    return "contenteditable";
  }

  // Default to text if no other type is found
  return "text";
}

function isTextInputType(type) {
  const textTypes = [
    "text",
    "textarea",
    "contenteditable",
    "textbox",
    "email",
    "search",
    "tel",
    "url",
    "password",
  ];
  return textTypes.includes(type.toLowerCase());
}

function parsePageContent() {
  console.log(
    "%c[SLP-AI] Parsing page content...",
    "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
  );

  const pageStructure = {
    title: document.title,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    sections: [],
    inputFields: [],
    generalContent: [],
    soapSections: {
      subjective: [],
      objective: [],
      assessment: [],
      plan: [],
    },
    dates: [],
    patientInfo: {
      firstName: "",
      lastName: "",
      fullName: "",
      birthDate: "",
    },
  };

  // Zanda Health-specific extraction
  try {
    // Plan: Next: Get better
    const planDiv = document.querySelector('div.com-field-title:contains("Next")');
    if (planDiv) {
      const planValueDiv = planDiv.parentElement?.querySelector('.com-field-div-textarea div[bis_skin_checked="1"]');
      if (planValueDiv) {
        const planText = planValueDiv.textContent.trim();
        pageStructure.soapSections.plan.push(`Next: ${planText}`);
        console.log('[SLP-AI] Extracted Plan:', planText);
      }
    }

    // Signature (optional, for completeness)
    const signatureDiv = document.querySelector('div.com-field-title:contains("Signature")');
    if (signatureDiv) {
      const signatureValueDiv = signatureDiv.parentElement?.querySelector('.signature-text');
      if (signatureValueDiv) {
        const signatureText = signatureValueDiv.textContent.trim();
        pageStructure.soapSections.plan.push(`Signature: ${signatureText}`);
        console.log('[SLP-AI] Extracted Signature:', signatureText);
      }
    }

    // TODO: Add similar logic for Subjective, Objective, Assessment
    // Example: Find by field titles or unique class names
    // You may need to inspect the HTML for each section and add selectors here

  } catch (err) {
    console.error('[SLP-AI] Error in Zanda Health-specific extraction:', err);
  }

  // Extract dates from the page (useful for medical context)
  extractDates(pageStructure);

  // Extract patient information from the page
  extractPatientInfo(pageStructure);

  // First, try to find specific SOAP section containers
  const potentialSoapContainers = [
    ...document.querySelectorAll(
      ".soap-note, .soap, .clinical-note, .patient-note, .medical-note, .note-container, .chart-note, .progress-note"
    ),
    ...document.querySelectorAll(
      '[id*="soap"], [id*="note"], [id*="clinical"], [id*="progress"], [class*="soap"], [class*="note"], [class*="clinical"], [class*="progress"]'
    ),
  ];

  // If we found potential SOAP containers, prioritize content from them
  if (potentialSoapContainers.length > 0) {
    console.log(
      "%c[SLP-AI] Found potential SOAP containers: %d",
      "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
      potentialSoapContainers.length
    );
    potentialSoapContainers.forEach((container, idx) => {
      console.log(
        "%c[SLP-AI] Container #%d: %s",
        "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
        idx,
        container.tagName,
        container.className,
        container.id
      );
    });
    potentialSoapContainers.forEach((container) => {
      // Look for headings within the container
      const containerHeadings = container.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, .section-title, .note-section, .soap-section"
      );

      if (containerHeadings.length > 0) {
        // Process headings within the container
        containerHeadings.forEach((heading) => {
          processHeadingAndContent(heading, pageStructure);
        });
      } else {
        // If no headings, try to infer sections from the container's structure
        inferSoapSectionsFromContainer(container, pageStructure);
      }
    });
  }

  // If we didn't find any SOAP sections yet, fall back to scanning all headings
  if (
    Object.values(pageStructure.soapSections).every((arr) => arr.length === 0)
  ) {
    console.log(
      "%c[SLP-AI] No SOAP sections found in containers, scanning all headings",
      "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;"
    );
    // Find all headings and their associated content
    const headings = document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, .section-title, .note-section"
    );
    headings.forEach((heading) => {
      processHeadingAndContent(heading, pageStructure);
    });
  }

  // If we still don't have any SOAP sections, try to extract from paragraphs and divs
  if (
    Object.values(pageStructure.soapSections).every((arr) => arr.length === 0)
  ) {
    console.log(
      "%c[SLP-AI] No SOAP sections found in headings, scanning paragraphs and divs",
      "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;"
    );
    const contentBlocks = document.querySelectorAll(
      "p, div:not(:has(p)):not(:has(div))"
    );

    contentBlocks.forEach((block) => {
      const text = cleanText(block.textContent);
      if (text.length > 20) {
        // Only consider substantial blocks of text
        const sectionInfo = {
          level: 0,
          title: "", // No title for these blocks
          content: text,
          element: block,
        };

        // Try to categorize this block
        categorizeSoapSection(sectionInfo, pageStructure.soapSections);
      }
    });
  }

  // Extract general content from the page (paragraphs, lists, etc.)
  extractGeneralContent(pageStructure);

  // Find all input fields
  const inputSelectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
    "textarea",
    "select",
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];

  document.querySelectorAll(inputSelectors.join(",")).forEach((input) => {
    // Only include visible and interactive fields
    if (input.offsetParent !== null && !input.disabled) {
      const fieldInfo = {
        type: getInputType(input),
        label: getLabelText(input),
        id: input.id || `field-${Math.random().toString(36).substr(2, 9)}`,
        elementRef: input,
        context: getFieldContext(input),
        soapCategory: determineSoapCategory(input),
      };

      pageStructure.inputFields.push(fieldInfo);
    }
  });

  // Send the extracted content to the sidebar
  sendContentToSidebar(pageStructure);

  console.log("Parsed page structure:", pageStructure);
  return pageStructure;
}

// Helper function to process a heading and its content
function processHeadingAndContent(heading, pageStructure) {
  console.log(
    "%c[SLP-AI] Processing heading: %s",
    "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;",
    heading.textContent.trim()
  );
  let content = [];
  let currentElement = heading.nextElementSibling;

  // Collect content until next heading
  while (
    currentElement &&
    !currentElement.matches(
      "h1, h2, h3, h4, h5, h6, .section-title, .note-section, .soap-section"
    )
  ) {
    if (currentElement.textContent.trim()) {
      content.push(cleanText(currentElement.textContent));
    }
    currentElement = currentElement.nextElementSibling;
  }

  const sectionInfo = {
    level: heading.tagName ? parseInt(heading.tagName[1]) : 0,
    title: cleanText(heading.textContent),
    content: content.join(" "),
    element: heading,
  };

  pageStructure.sections.push(sectionInfo);

  // Categorize into SOAP sections if applicable
  const soapCategory = categorizeSoapSection(
    sectionInfo,
    pageStructure.soapSections
  );
  console.log(
    "%c[SLP-AI] Heading '%s' categorized as: %s",
    "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;",
    sectionInfo.title,
    soapCategory || "none"
  );
}

// Helper function to infer SOAP sections from container structure
function inferSoapSectionsFromContainer(container, pageStructure) {
  console.log(
    "%c[SLP-AI] Inferring SOAP sections from container: %s",
    "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;",
    container.tagName,
    container.className,
    container.id
  );
  // Look for divs, paragraphs, or spans that might contain section content
  const potentialSections = container.querySelectorAll("div, p, span");

  potentialSections.forEach((section) => {
    const text = cleanText(section.textContent);
    if (text.length > 10) {
      // Only consider non-trivial text
      // Try to infer if this is a section title or content
      const isSectionTitle =
        section.children.length === 0 &&
        text.length < 50 &&
        /subjective|objective|assessment|plan|s:|o:|a:|p:|history|exam|diagnosis|recommendation/i.test(
          text
        );

      if (isSectionTitle) {
        // This looks like a section title, get the content that follows
        let contentElements = [];
        let currentElement = section.nextElementSibling;

        while (
          currentElement &&
          !/subjective|objective|assessment|plan|s:|o:|a:|p:|history|exam|diagnosis|recommendation/i.test(
            currentElement.textContent
          ) &&
          currentElement.children.length === 0
        ) {
          contentElements.push(cleanText(currentElement.textContent));
          currentElement = currentElement.nextElementSibling;
        }

        const sectionInfo = {
          level: 0,
          title: text,
          content: contentElements.join(" "),
          element: section,
        };

        pageStructure.sections.push(sectionInfo);
        categorizeSoapSection(sectionInfo, pageStructure.soapSections);
      } else {
        // This might be content without a clear title
        const sectionInfo = {
          level: 0,
          title: "",
          content: text,
          element: section,
        };

        categorizeSoapSection(sectionInfo, pageStructure.soapSections);
      }
    }
  });

  // Extract general content from the page (paragraphs, lists, etc.)
  extractGeneralContent(pageStructure);

  // Find all input fields
  const inputSelectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
    "textarea",
    "select",
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];

  document.querySelectorAll(inputSelectors.join(",")).forEach((input) => {
    // Only include visible and interactive fields
    if (input.offsetParent !== null && !input.disabled) {
      const fieldInfo = {
        type: getInputType(input),
        label: getLabelText(input),
        id: input.id || `field-${Math.random().toString(36).substr(2, 9)}`,
        elementRef: input,
        context: getFieldContext(input),
        soapCategory: determineSoapCategory(input),
      };

      pageStructure.inputFields.push(fieldInfo);
    }
  });

  // Send the extracted content to the sidebar
  sendContentToSidebar(pageStructure);

  console.log("Parsed page structure:", pageStructure);
  return pageStructure;
}

/**
 * Extract dates from the page content
 */
function extractDates(pageStructure) {
  // Date pattern regex - looks for common date formats
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // MM/DD/YYYY or DD/MM/YYYY
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, // MM-DD-YYYY or DD-MM-YYYY
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi, // Month DD, YYYY
    /\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/gi, // DD Month YYYY
    /\b(?:today|yesterday|tomorrow)\b/gi, // Relative dates
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, // Days of week
  ];

  // Get all text nodes
  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    }
  );

  const dates = new Set();
  let node;
  while ((node = textWalker.nextNode())) {
    const text = node.textContent.trim();

    // Check for date patterns
    datePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => dates.add(match));
      }
    });
  }

  pageStructure.dates = Array.from(dates);
}

/**
 * Extract patient information from the page content
 */
function extractPatientInfo(pageStructure) {
  // Get all text nodes
  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    }
  );

  // Regular expressions for patient information
  const namePatterns = [
    // Pattern for "Patient: John Doe" or "Patient Name: John Doe"
    /\bpatient(?:\s+name)?\s*[:;]\s*([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\b/i,
    // Pattern for "Name: John Doe"
    /\bname\s*[:;]\s*([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\b/i,
    // Pattern for "Patient: John Doe"
    /\bpatient\s*[:;]\s*([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\b/i,
  ];

  const dobPatterns = [
    // Pattern for "DOB: MM/DD/YYYY" or "Date of Birth: MM/DD/YYYY"
    /\b(?:DOB|Date\s+of\s+Birth)\s*[:;]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/i,
    // Pattern for "Born: MM/DD/YYYY"
    /\bBorn\s*[:;]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/i,
    // Pattern for "Birth Date: MM/DD/YYYY"
    /\bBirth\s+Date\s*[:;]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/i,
  ];

  // Collect all text content
  let allText = "";
  let node;
  while ((node = textWalker.nextNode())) {
    allText += node.textContent.trim() + " ";
  }

  // Try to extract full name
  let fullName = "";
  for (const pattern of namePatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      fullName = match[1].trim();
      break;
    }
  }

  // If we found a full name, try to split it into first and last name
  if (fullName) {
    pageStructure.patientInfo.fullName = fullName;
    const nameParts = fullName.split(/\s+/);
    if (nameParts.length >= 2) {
      pageStructure.patientInfo.firstName = nameParts[0];
      pageStructure.patientInfo.lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1) {
      pageStructure.patientInfo.firstName = nameParts[0];
    }
  }

  // Try to extract date of birth
  for (const pattern of dobPatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      pageStructure.patientInfo.birthDate = match[1].trim();
      break;
    }
  }

  // If no DOB found in specific patterns, try to use the first date found
  if (!pageStructure.patientInfo.birthDate && pageStructure.dates.length > 0) {
    // Check if any date is near text suggesting it's a birth date
    const birthDateIndicators = ["birth", "dob", "born"];
    const lowerText = allText.toLowerCase();

    for (const indicator of birthDateIndicators) {
      if (lowerText.includes(indicator) && pageStructure.dates.length > 0) {
        pageStructure.patientInfo.birthDate = pageStructure.dates[0];
        break;
      }
    }
  }

  console.log("Extracted patient info:", pageStructure.patientInfo);
}

/**
 * Extract general content from the page including paragraphs, lists, etc.
 * Limits the amount of content to prevent memory issues
 */
function extractGeneralContent(pageStructure, maxCharacters = 10000) {
  let totalCharacters = 0;
  const contentElements = [];

  // Priority elements to extract content from
  const contentSelectors = [
    "p",
    "li",
    "div:not(:has(*))",
    "span:not(:has(*))",
    "article",
    "section",
    "main",
    "td",
    "th",
  ];

  // Get all relevant elements
  document.querySelectorAll(contentSelectors.join(",")).forEach((element) => {
    // Skip hidden elements and those with no content
    if (element.offsetParent === null || !element.textContent.trim()) {
      return;
    }

    // Skip elements that are children of elements we've already added
    if (contentElements.some((e) => e.contains(element))) {
      return;
    }

    // Get the text content
    const text = cleanText(element.textContent);

    // Skip if we've reached the character limit
    if (totalCharacters + text.length > maxCharacters) {
      return;
    }

    contentElements.push(element);
    totalCharacters += text.length;

    pageStructure.generalContent.push({
      text: text,
      elementType: element.tagName.toLowerCase(),
      isVisible: element.offsetParent !== null,
      position: getElementPosition(element),
    });
  });
}

/**
 * Get the position of an element on the page
 */
function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    height: rect.height,
    width: rect.width,
  };
}

/**
 * Categorize a section as part of the SOAP note structure
 */
function categorizeSoapSection(section, soapSections) {
  console.log(
    "%c[SLP-AI] Categorizing section: %s",
    "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
    section.title || "[No Title]"
  );
  const title = section.title.toLowerCase();
  const content = section.content.toLowerCase();
  const combinedText = `${title} ${content}`;

  // Zanda Health-specific SOAP patterns
  const soapPatterns = {
    subjective: {
      exactMatches: ["subjective", "today, client was", "check boxes"],
      partialMatches: ["happy", "quiet and shy"]
    },
    objective: {
      exactMatches: ["objective & assessment", "today's activities", "goal 1", "level of support required"],
      partialMatches: ["good boy", "be better", "independent", "minimum cueing", "moderate cueing", "maximum cueing"]
    },
    assessment: {
      exactMatches: ["goal progress and strategies used", "home activities/handouts", "recommendations"],
      partialMatches: ["continue with goal as set", "modify goal"]
    },
    plan: {
      exactMatches: ["plan", "next:", "signature"],
      partialMatches: ["get better", "manas"]
    }
  };

  function containsAny(text, patterns) {
    return patterns.some((pattern) => {
      const regex = new RegExp(`\\b${pattern.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i");
      return regex.test(text);
    });
  }

  function containsAnyPartial(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  // First check for exact title matches (highest priority)
  for (const [type, patterns] of Object.entries(soapPatterns)) {
    if (containsAny(title, patterns.exactMatches)) {
      console.log(
        "%c[SLP-AI] Found exact title match for '%s': %s",
        "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
        title,
        type
      );
      soapSections[type].push(section);
      return type;
    }
  }

  // Then check for partial matches in title
  for (const [type, patterns] of Object.entries(soapPatterns)) {
    if (containsAnyPartial(title, patterns.partialMatches)) {
      console.log(
        "%c[SLP-AI] Found partial title match for '%s': %s",
        "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
        title,
        type
      );
      soapSections[type].push(section);
      return type;
    }
  }

  // If no match in title, check content for exact matches
  for (const [type, patterns] of Object.entries(soapPatterns)) {
    if (containsAny(content, patterns.exactMatches)) {
      console.log(
        "%c[SLP-AI] Found exact content match for type: %s",
        "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
        type
      );
      soapSections[type].push(section);
      return type;
    }
  }

  // Finally check content for partial matches
  for (const [type, patterns] of Object.entries(soapPatterns)) {
    if (containsAnyPartial(content, patterns.partialMatches)) {
      console.log(
        "%c[SLP-AI] Found partial content match for type: %s",
        "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
        type
      );
      soapSections[type].push(section);
      return type;
    }
  }

  // If we get here, no matches were found
  return null;
}

/**
 * Determine which SOAP category an input field belongs to
 */
function determineSoapCategory(inputElement) {
  // Get text associated with this input
  const labelText = getLabelText(inputElement);
  const nearbyText = getFieldContext(inputElement).nearbyText.join(" ");
  const combinedText = `${labelText} ${nearbyText}`.toLowerCase();

  // More comprehensive SOAP category patterns
  const soapPatterns = {
    subjective:
      /\b(?:subjective|history|chief complaint|reason for visit|patient reports|patient states|symptoms|hpi|history of present illness|client reports|client states|per patient|per client|per caregiver)\b/i,
    objective:
      /\b(?:objective|physical exam|findings|observations|vitals|measurements|test results|evaluation results|assessment data|testing|evaluation|observed|noted|presents with|demonstrated|exhibits)\b/i,
    assessment:
      /\b(?:assessment|diagnosis|impression|conclusion|clinical opinion|clinical impression|diagnostic impression|summary|appears to|likely has|consistent with|suggestive of|indicative of)\b/i,
    plan: /\b(?:plan|treatment|recommendations|follow-up|therapy|intervention|next steps|plan of care|poc|will|should|recommend|advised|suggested|scheduled for|referral|refer to)\b/i,
  };

  // Check for SOAP patterns
  for (const [type, pattern] of Object.entries(soapPatterns)) {
    if (pattern.test(combinedText)) {
      return type;
    }
  }

  return null;
}

/**
 * Send the extracted content to the sidebar
 */
function sendContentToSidebar(pageStructure) {
  try {
    // Create a clean version without DOM references
    const cleanStructure = JSON.parse(
      JSON.stringify(pageStructure, (key, value) => {
        // Skip DOM element references
        if (key === "element" || key === "elementRef") {
          return undefined;
        }
        return value;
      })
    );

    // Send message to sidebar
    chrome.runtime.sendMessage({
      action: "pageContentExtracted",
      content: cleanStructure,
    });

    console.log("Sent page content to sidebar");
  } catch (error) {
    console.error("Error sending content to sidebar:", error);
  }
}

function getLabelText(element) {
  // Check for explicit label
  const labelElement =
    element.labels?.[0] || document.querySelector(`label[for="${element.id}"]`);
  if (labelElement) {
    return cleanText(labelElement.textContent);
  }

  // Check for aria-label
  if (element.getAttribute("aria-label")) {
    return cleanText(element.getAttribute("aria-label"));
  }

  // Check for placeholder
  if (element.getAttribute("placeholder")) {
    return cleanText(element.getAttribute("placeholder"));
  }

  // Check for nearby text that might be a label
  const previousElement = element.previousElementSibling;
  if (previousElement && !previousElement.matches("input, textarea, select")) {
    return cleanText(previousElement.textContent);
  }

  // Fallback to name or id
  return element.name || element.id || "Unnamed Field";
}

function getFieldContext(element) {
  const context = {
    pageTitle: document.title,
    url: window.location.href,
    nearbyText: [],
    formPurpose: "",
  };

  // Get form purpose from nearby headings
  const nearbyHeadings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .filter((heading) => {
      const rect = heading.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return Math.abs(rect.top - elementRect.top) < 500; // Within 500px
    })
    .map((heading) => heading.textContent.trim());

  context.formPurpose = nearbyHeadings.join(" - ");

  // Get nearby paragraph text
  const nearbyParagraphs = Array.from(document.querySelectorAll("p"))
    .filter((p) => {
      const rect = p.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return Math.abs(rect.top - elementRect.top) < 200; // Within 200px
    })
    .map((p) => p.textContent.trim());

  context.nearbyText = nearbyParagraphs;

  return context;
}

function extractFieldContext(element, maxWords = 50) {
  const contextElements = [];
  let currentElement = element;

  // Look for nearby headers
  while (currentElement && contextElements.length < 3) {
    const header = currentElement.querySelector("h1, h2, h3, h4, h5, h6");
    if (header) {
      contextElements.push(header.textContent);
    }
    currentElement = currentElement.parentElement;
  }

  // Get nearby labels and text
  const nearbyText = [];
  const walker = document.createTreeWalker(
    element.closest("form") || element.parentElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        return node.textContent.trim().length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode()) && nearbyText.length < maxWords) {
    nearbyText.push(cleanText(node.textContent));
  }

  return {
    headers: contextElements,
    nearbyText: nearbyText.join(" "),
    questionType: inferQuestionType(element, contextElements.join(" ")),
  };
}

function inferQuestionType(element, context) {
  const patterns = {
    assessment: /(assess|evaluate|rate|score|grade|measure)/i,
    observation: /(observe|notice|see|watch|monitor)/i,
    diagnosis: /(diagnos|condition|symptom|present)/i,
    treatment: /(treat|therapy|intervention|approach|strategy)/i,
    progress: /(progress|improvement|change|development)/i,
  };

  const combinedText = `${
    element.labels?.[0]?.textContent || ""
  } ${context}`.toLowerCase();

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(combinedText)) {
      return type;
    }
  }

  return "general";
}

function highlightTargetField(element) {
  removeHighlights();

  const rect = element.getBoundingClientRect();
  const highlight = document.createElement("div");
  highlight.className = "slp-ai-target-highlight";

  // Position the highlight over the input
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  document.body.appendChild(highlight);
}

function formatContentForSidebar(pageStructure) {
  return `
    <div class="parsed-content">
      <div class="content-header">
        <h2>Page Content</h2>
        <input type="text" class="content-search" placeholder="Search content...">
      </div>
      
      <div class="content-sections">
        ${pageStructure.sections
          .map(
            (section) => `
          <div class="content-card">
            <div class="card-header">
              <h${section.level}>${section.title}</h${section.level}>
              <button class="expand-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="card-content hidden">
              <p>${section.content}</p>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="input-fields-section">
        <h3>Input Fields</h3>
        ${pageStructure.inputFields
          .map((field) => formatFieldCard(field))
          .join("")}
      </div>
    </div>
  `;
}

function formatFieldCard(field) {
  if (!field.label || !field.elementRef) {
    return "";
  }

  return `
    <div class="field-card" data-field-id="${field.id}" data-field-type="${
    field.type
  }">
      <div class="field-header">
        <div class="field-info">
          <div class="field-title">${field.label}</div>
        </div>
        <div class="field-meta">
          <span class="field-preview">${getFieldPreview(
            field.elementRef
          )}</span>
        </div>
      </div>
      <div class="field-content">
        <div class="field-status">
          <span class="status-tag ${getStatusClass(field.type)}">${
    field.type
  }</span>
          <span class="field-state">Monitoring</span>
        </div>
      </div>
      <div class="field-actions">
        <button class="ai-generate-btn" data-field-id="${field.id}">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M10 3.5a6.5 6.5 0 00-5.288 10.292l-.565 1.98A.75.75 0 005 16.5h10a.75.75 0 00.853-.728l-.565-1.98A6.5 6.5 0 0010 3.5z"/>
          </svg>
          Generate Response
        </button>
        <button class="locate-btn" data-field-id="${field.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 3l-6 6m0 0V4m0 5h5M5 21l6-6m0 0v5m0-5H4" stroke-width="2"/>
          </svg>
          Locate
        </button>
      </div>
      <div class="generation-panel hidden" data-field-id="${field.id}">
        <div class="generation-content">
          <div class="notes-section">
            <label for="notes-${field.id}">Additional Notes</label>
            <textarea id="notes-${
              field.id
            }" placeholder="Add any specific requirements or context for generation..."></textarea>
          </div>
          <div class="template-section">
            <label>Template Type</label>
            <div class="template-options">
              <button class="template-btn active" data-template="default">Default</button>
              <button class="template-btn" data-template="assessment">Assessment</button>
              <button class="template-btn" data-template="observation">Observation</button>
              <button class="template-btn" data-template="treatment">Treatment</button>
            </div>
          </div>
          <div class="generation-actions">
            <button class="cancel-btn">Cancel</button>
            <button class="generate-confirm-btn" data-field-id="${field.id}">
              Generate
              <span class="loading-spinner hidden"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Add new utility functions
function getFieldPreview(element) {
  let preview = "";

  // Get current value or placeholder
  if (element.value) {
    preview = element.value;
  } else if (element.placeholder) {
    preview = element.placeholder;
  } else if (element.textContent) {
    preview = element.textContent;
  }

  // Truncate and clean the preview
  preview = preview.trim().slice(0, 50);
  return preview ? `"${preview}${preview.length > 49 ? "..." : ""}"` : "";
}

function getStatusClass(type) {
  const statusMap = {
    text: "status-major",
    textarea: "status-critical",
    email: "status-warning",
    default: "status-monitoring",
  };
  return statusMap[type] || statusMap.default;
}

// // Update hover mode functionality
// function initializeHoverMode() {
//   const button = createHoverButton();
//   let currentTarget = null;

//   // Show button on hover over text inputs
//   document.addEventListener('mouseover', (e) => {
//     if (!isEnabled) return;

//     const target = e.target;
//     if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
//       currentTarget = target;
//       const rect = target.getBoundingClientRect();
//       button.style.display = 'block';
//       button.style.top = `${rect.top + window.scrollY - 30}px`;
//       button.style.left = `${rect.right + window.scrollX - 30}px`;

//       button.onclick = (e) => {
//         e.stopPropagation();
//         showGenerationPopover(target);
//       };
//     }
//   });

//   // Hide button when not hovering over inputs
//   document.addEventListener('mouseout', (e) => {
//     if (e.relatedTarget?.closest('.slp-ai-overlay-button')) return;
//     if (!e.relatedTarget?.closest('input, textarea')) {
//       button.style.display = 'none';
//       currentTarget = null;
//     }
//   });

//   // Update button position on scroll
//   document.addEventListener('scroll', () => {
//     if (currentTarget && button.style.display !== 'none') {
//       const rect = currentTarget.getBoundingClientRect();
//       button.style.top = `${rect.top + window.scrollY - 30}px`;
//       button.style.left = `${rect.right + window.scrollX - 30}px`;
//     }
//   });
// }

function showGenerationPopover(element) {
  const popover = document.createElement("div");
  popover.className = "ai-generation-popover";

  popover.innerHTML = `
    <div class="popover-header">
      <h3>Generate Content</h3>
      <button class="close-btn">×</button>
    </div>
    <div class="popover-content">
      <div class="input-area">
        <textarea placeholder="Enter your prompt here..."></textarea>
        <button class="generate-btn">
          Generate
          <span class="loading-spinner hidden"></span>
        </button>
      </div>
      <div class="response-area hidden">
        <div class="response-content"></div>
        <button class="copy-btn">Copy Response</button>
      </div>
    </div>
  `;

  document.body.appendChild(popover);
  setupPopoverPosition(popover, element);
  setupPopoverHandlers(popover, element);
}

function setupPopoverPosition(popover, targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // Calculate position
  let top = rect.bottom + window.scrollY + 10;

  // If popover would go off bottom of screen, position above element instead
  if (top + popover.offsetHeight > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - popover.offsetHeight - 10;
  }

  popover.style.top = `${top}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;
}

function setupPopoverHandlers(popover, targetElement) {
  const closeBtn = popover.querySelector(".close-btn");
  const generateBtn = popover.querySelector(".generate-btn");
  const copyBtn = popover.querySelector(".copy-btn");
  const responseArea = popover.querySelector(".response-area");
  const textarea = popover.querySelector("textarea");

  closeBtn.onclick = () => popover.remove();

  generateBtn.onclick = async () => {
    const prompt = textarea.value;
    if (!prompt.trim()) {
      showError("Please enter what you would like to generate.");
      return;
    }

    thinking.classList.remove("hidden");
    generateBtn.disabled = true;

    try {
      const response = await OpenAIService.generateResponse(prompt, {
        element: targetElement,
        context: getFieldContext(targetElement),
      });

      responseArea.classList.remove("hidden");
      responseArea.querySelector(".response-content").textContent = response;

      copyBtn.onclick = () => {
        navigator.clipboard.writeText(response);
        copyBtn.classList.add("success");
        setTimeout(() => copyBtn.classList.remove("success"), 2000);
      };
    } catch (error) {
      console.error("Generation error:", error);
      showError("Failed to generate response. Please check your API key.");
    } finally {
      thinking.classList.add("hidden");
      generateBtn.disabled = false;
    }
  };
}

function showError(message) {
  const errorToast = document.createElement("div");
  errorToast.className = "error-toast";
  errorToast.textContent = message;
  document.body.appendChild(errorToast);

  setTimeout(() => {
    errorToast.remove();
  }, 3000);
}

// Add the removeHighlights function
function removeHighlights() {
  document
    .querySelectorAll(".slp-ai-target-highlight")
    .forEach((el) => el.remove());
}

// Add event listeners for generation panel
function setupGenerationPanel(card) {
  const generateBtn = card.querySelector(".ai-generate-btn");
  const panel = card.querySelector(".generation-panel");
  const cancelBtn = panel.querySelector(".cancel-btn");
  const confirmBtn = panel.querySelector(".generate-confirm-btn");
  const templateBtns = panel.querySelectorAll(".template-btn");

  generateBtn.addEventListener("click", () => {
    panel.classList.remove("hidden");
    card.classList.add("expanded");
  });

  cancelBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
    card.classList.remove("expanded");
  });

  templateBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      templateBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  confirmBtn.addEventListener("click", async () => {
    const fieldId = confirmBtn.dataset.fieldId;
    const notes = panel.querySelector(`#notes-${fieldId}`).value;
    const template = panel.querySelector(".template-btn.active").dataset
      .template;

    confirmBtn.disabled = true;
    confirmBtn.querySelector(".loading-spinner").classList.remove("hidden");

    // try {
    //   await handleGenerateResponse({
    //     id: fieldId,
    //     notes,
    //     template,
    //     elementRef: document.querySelector(`[data-field-id="${fieldId}"]`)
    //   });

    //   panel.classList.add('hidden');
    //   card.classList.remove('expanded');
    // } finally {
    //   confirmBtn.disabled = false;
    //   confirmBtn.querySelector('.loading-spinner').classList.add('hidden');
    // }
  });
}

// Initialize with logging
console.log("Content script loaded, starting initialization...");
initialize();

function createSelectionPopover() {
  const popover = document.createElement("div");
  popover.className = "ai-selection-popover hidden";
  popover.innerHTML = `
    <button class="generate-btn">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
      </svg>
      Generate Response
    </button>
  `;
  document.body.appendChild(popover);
  return popover;
}

function showGenerationChat(selectedText, position) {
  const chat = document.createElement("div");
  chat.className = "ai-chat-window";

  chat.innerHTML = `
    <div class="chat-header">
      <h3>AI Response Generation</h3>
      <button class="close-btn">×</button>
    </div>
    <div class="chat-content">
      <div class="selected-text">
        <strong>Selected Text:</strong>
        <p>${selectedText}</p>
      </div>
      <div class="messages"></div>
      <div class="thinking hidden">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <p>Generating response...</p>
      </div>
    </div>
    <div class="chat-footer">
      <textarea placeholder="Add any specific requirements or context..."></textarea>
      <button class="generate-btn">Generate</button>
      <button class="copy-btn hidden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
        </svg>
        Copy Response
      </button>
    </div>
  `;

  // Position near the selection
  chat.style.left = `${position.x}px`;
  chat.style.top = `${position.y}px`;

  document.body.appendChild(chat);
  return chat;
}

// Handle text selection
document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popover = document.querySelector(".ai-selection-popover");
    popover.style.left = `${rect.left + rect.width / 2}px`;
    popover.style.top = `${rect.bottom + 10}px`;
    popover.classList.remove("hidden");

    popover.querySelector(".generate-btn").onclick = () => {
      popover.classList.add("hidden");
      const chat = showGenerationChat(selectedText, {
        x: rect.left,
        y: rect.bottom + 10,
      });

      setupChatHandlers(chat, selectedText);
    };
  } else {
    document.querySelector(".ai-selection-popover")?.classList.add("hidden");
  }
});

function setupChatHandlers(chat, selectedText) {
  const closeBtn = chat.querySelector(".close-btn");
  const generateBtn = chat.querySelector(".generate-btn");
  const copyBtn = chat.querySelector(".copy-btn");
  const thinking = chat.querySelector(".thinking");
  const messages = chat.querySelector(".messages");

  closeBtn.onclick = () => chat.remove();

  generateBtn.onclick = async () => {
    const additionalContext = chat.querySelector("textarea").value;
    thinking.classList.remove("hidden");
    generateBtn.disabled = true;

    try {
      const response = await generateResponse(selectedText, additionalContext);

      messages.innerHTML += `
        <div class="message">
          <div class="message-content">${response}</div>
        </div>
      `;

      copyBtn.classList.remove("hidden");
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(response);
        copyBtn.classList.add("success");
        setTimeout(() => copyBtn.classList.remove("success"), 2000);
      };
    } catch (error) {
      showError("Failed to generate response");
    } finally {
      thinking.classList.add("hidden");
      generateBtn.disabled = false;
    }
  };
}

// function handleGenerateResponse({ notes, template, elementRef }) {
//   try {
//     const context = getFieldContext(elementRef);
//     const smartPrompt = generateSmartPrompt({
//       label: context.label || 'field',
//       context: context,
//       questionType: template || 'general'
//     });

//     const prompt = notes ? `${smartPrompt}\nAdditional context: ${notes}` : smartPrompt;

//     const response = await OpenAIService.generateResponse(prompt);

//     // Update the field with the generated response
//     if (elementRef) {
//       if (elementRef.tagName === 'TEXTAREA' || elementRef.tagName === 'INPUT') {
//         elementRef.value = response;
//       } else if (elementRef.isContentEditable) {
//         elementRef.textContent = response;
//       }

//       // Trigger input event to ensure any listeners are notified
//       elementRef.dispatchEvent(new Event('input', { bubbles: true }));
//     }

//     return response;
//   } catch (error) {
//     console.error('Generation error:', error);
//     showError('Failed to generate response. Please check your API key.');
//     throw error;
//   }
// }

// Handle extension toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "%c[SLP-AI Content] Received toggle message:",
    "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;",
    message
  );

  if (message.action === "toggleExtension") {
    console.log(
      "%c[SLP-AI Content] Toggling extension to: %s",
      "color: #f39c12;",
      message.isEnabled ? "enabled" : "disabled"
    );
    isEnabled = message.isEnabled;
    if (!isEnabled) {
      button.style.display = "none";
    }
  }
});

// // Initialize on page load
// document.addEventListener("DOMContentLoaded", initializeHoverMode);
// // Also initialize immediately in case DOM is already loaded
// if (document.readyState === "complete") {
//   initializeHoverMode();
// }

function setupSidebarHandlers(sidebar) {
  const closeBtn = sidebar.querySelector(".close-btn");
  const generateBtn = sidebar.querySelector(".generate-btn");
  const textarea = sidebar.querySelector(".prompt-textarea");
  const responseSection = sidebar.querySelector(".response-section");
  const responseContent = sidebar.querySelector(".response-content");
  const copyBtn = sidebar.querySelector(".copy-btn");
  const spinner = generateBtn.querySelector(".loading-spinner");

  closeBtn.onclick = () => {
    sidebar.classList.remove("open");
    isOpen = false;
  };

  generateBtn.onclick = async () => {
    const prompt = textarea.value.trim();
    if (!prompt) {
      showError("Please enter a prompt");
      return;
    }

    generateBtn.disabled = true;
    spinner.classList.remove("hidden");

    try {
      const response = await OpenAIService.generateResponse(prompt);
      responseContent.textContent = response;
      responseSection.classList.remove("hidden");
    } catch (error) {
      showError("Failed to generate response");
    } finally {
      generateBtn.disabled = false;
      spinner.classList.add("hidden");
    }
  };

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(responseContent.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Response";
    }, 2000);
  };
}

// Add initialization function
function initialize() {
  console.log("Initializing extension components...");

  // Create core UI elements
  button = createOverlayButton();
  sidebar = createSidebar();

  // Create selection-related elements
  const selectionPopover = createSelectionPopover();

  // Initialize hover mode
  // initializeHoverMode();

  // Parse initial page content
  const pageStructure = parsePageContent();

  // Set up message listener for communication with sidebar
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(
      "%c[SLP-AI Content] Received message:",
      "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;",
      request
    );
    console.log(
      "%c[SLP-AI Content] Message sender:",
      "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;",
      sender
    );

    // Handle ping message to check if content script is loaded
    if (request.action === "ping") {
      console.log(
        "%c[SLP-AI Content] Received ping, responding with pong",
        "color: #9b59b6;"
      );
      sendResponse({ status: "pong", loaded: true });
      return true;
    }

    if (request.action === "extractPageContent") {
      console.log(
        "%c[SLP-AI Content] Received extractPageContent request",
        "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;"
      );
      try {
        console.log(
          "%c[SLP-AI] ===== STARTING SOAP NOTE EXTRACTION =====",
          "background: #3498db; color: white; padding: 5px; font-weight: bold; font-size: 14px;"
        );
        const pageContent = parsePageContent();

        // Log the SOAP sections that were found
        console.log(
          "%c[SLP-AI] ===== EXTRACTION RESULTS =====",
          "background: #3498db; color: white; padding: 5px; font-weight: bold; font-size: 14px;"
        );
        console.log(
          "%c[SLP-AI] Subjective sections found: %d",
          "background: #2ecc71; color: white; padding: 2px 5px;",
          pageContent.soapSections.subjective.length
        );
        console.log(
          "%c[SLP-AI] Objective sections found: %d",
          "background: #2ecc71; color: white; padding: 2px 5px;",
          pageContent.soapSections.objective.length
        );
        console.log(
          "%c[SLP-AI] Assessment sections found: %d",
          "background: #2ecc71; color: white; padding: 2px 5px;",
          pageContent.soapSections.assessment.length
        );
        console.log(
          "%c[SLP-AI] Plan sections found: %d",
          "background: #2ecc71; color: white; padding: 2px 5px;",
          pageContent.soapSections.plan.length
        );

        // Log the actual content of each section
        if (pageContent.soapSections.subjective.length > 0) {
          console.log(
            "%c[SLP-AI] Subjective content:",
            "background: #3498db; color: white; padding: 2px 5px;"
          );
          pageContent.soapSections.subjective.forEach((section, i) => {
            console.log(
              `%c[SLP-AI] Section ${i + 1}: ${section.title}`,
              "color: #3498db;"
            );
            console.log(section.content);
          });
        }

        if (pageContent.soapSections.objective.length > 0) {
          console.log(
            "%c[SLP-AI] Objective content:",
            "background: #3498db; color: white; padding: 2px 5px;"
          );
          pageContent.soapSections.objective.forEach((section, i) => {
            console.log(
              `%c[SLP-AI] Section ${i + 1}: ${section.title}`,
              "color: #3498db;"
            );
            console.log(section.content);
          });
        }

        if (pageContent.soapSections.assessment.length > 0) {
          console.log(
            "%c[SLP-AI] Assessment content:",
            "background: #3498db; color: white; padding: 2px 5px;"
          );
          pageContent.soapSections.assessment.forEach((section, i) => {
            console.log(
              `%c[SLP-AI] Section ${i + 1}: ${section.title}`,
              "color: #3498db;"
            );
            console.log(section.content);
          });
        }

        if (pageContent.soapSections.plan.length > 0) {
          console.log(
            "%c[SLP-AI] Plan content:",
            "background: #3498db; color: white; padding: 2px 5px;"
          );
          pageContent.soapSections.plan.forEach((section, i) => {
            console.log(
              `%c[SLP-AI] Section ${i + 1}: ${section.title}`,
              "color: #3498db;"
            );
            console.log(section.content);
          });
        }

        console.log(
          "%c[SLP-AI] ===== END OF EXTRACTION =====",
          "background: #3498db; color: white; padding: 5px; font-weight: bold; font-size: 14px;"
        );

        // Log the response we're sending back
        console.log(
          "%c[SLP-AI Content] Sending extraction response:",
          "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;"
        );
        console.log(
          "%c[SLP-AI Content] Success: %s",
          "color: #9b59b6;",
          "true"
        );
        console.log("%c[SLP-AI Content] Data structure:", "color: #9b59b6;", {
          hasSoapSections: !!pageContent.soapSections,
          subjectiveCount: pageContent.soapSections?.subjective?.length || 0,
          objectiveCount: pageContent.soapSections?.objective?.length || 0,
          assessmentCount: pageContent.soapSections?.assessment?.length || 0,
          planCount: pageContent.soapSections?.plan?.length || 0,
        });

        sendResponse({ success: true, data: pageContent });
      } catch (error) {
        console.error(
          "%c[SLP-AI Content] Error extracting page content:",
          "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
          error
        );
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep the message channel open for async response
    }
  });

  // Set up global event listeners
  document.addEventListener("keydown", (e) => {
    // Close sidebar on Escape key
    if (e.key === "Escape" && isOpen) {
      sidebar.classList.remove("open");
      isOpen = false;
    }
  });

  // Handle clicks outside of components
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".slp-ai-sidebar") &&
      !e.target.closest(".slp-ai-overlay-button") &&
      !e.target.closest(".ai-selection-popover") &&
      !e.target.closest(".ai-chat-window")
    ) {
      selectionPopover.classList.add("hidden");
    }
  });

  console.log("Initialization complete");
}
