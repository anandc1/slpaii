document.addEventListener("DOMContentLoaded", async () => {
  // Initialize DOM elements
  const chatHistory = document.getElementById("chatHistory");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const testButton = document.getElementById("testButton");
  const previewContainer = document.getElementById("previewContainer");

  // Initialize extraction mode
  let extractionMode = "auto";
  let pageContent = null;

  // Initialize workflow state
  const workflowState = {
    currentStep: 1,
    totalSteps: 4,
    patient: {
      firstName: "",
      lastName: "",
      birthDate: "",
      uid: null,
    },
    soapNote: {
      patientUID: null,
      providerUID: null,
      type: "soap",
      dateCreated: null,
      dateAmended: null,
      data: {
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
      },
    },
    assessment: {
      patientUID: null,
      providerUID: null,
      type: null,
      dateCreated: null,
      dateAmended: null,
      data: {},
    },
    report: {
      patientUID: null,
      dateGenerated: null,
      sections: {},
    },
    extractedContent: null,
  };

  // Get UI elements
  const statusIndicator = document.getElementById("statusIndicator");
  const stepIndicators = document.querySelectorAll(".step-indicator");
  const workflowSteps = document.querySelectorAll(".workflow-step");

  // Initialize panel state and workflow
  try {
    const currentWindow = await chrome.windows.getCurrent();
    console.log("SLP Assistant initialized in window:", currentWindow.id);

    // Initialize the workflow to step 1
    setActiveStep(3);
    updateStatus("Ready. Create a new report to begin.", true);
  } catch (error) {
    console.error("Error initializing side panel:", error);
    updateStatus("Error", false);
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(
      "%c[SLP-AI Sidebar] Message received:",
      "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
      message
    );
    console.log(
      "%c[SLP-AI Sidebar] Message sender:",
      "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
      sender
    );

    if (message.action === "pageContentExtracted") {
      console.log(
        "%c[SLP-AI Sidebar] Received pageContentExtracted message",
        "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
      );

      // Reset extract SOAP button state if it exists
      const extractSoapBtn = document.getElementById("extractSoapBtn");
      if (extractSoapBtn) {
        extractSoapBtn.textContent = "Extract SOAP Note";
        extractSoapBtn.disabled = false;
      }

      // Check if we received content
      if (!message.content) {
        console.error(
          "%c[SLP-AI Sidebar] No content received in message!",
          "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;"
        );
        updateStatus("Error: No content received", false);
        sendResponse({ status: "error", message: "No content received" });
        return true;
      }

      console.log(
        "%c[SLP-AI Sidebar] Content received, processing...",
        "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
      );
      console.log("%c[SLP-AI Sidebar] Content structure:", "color: #3498db;", {
        hasSoapSections: !!message.content.soapSections,
        subjectiveCount: message.content.soapSections?.subjective?.length || 0,
        objectiveCount: message.content.soapSections?.objective?.length || 0,
        assessmentCount: message.content.soapSections?.assessment?.length || 0,
        planCount: message.content.soapSections?.plan?.length || 0,
      });

      // Process the extracted content
      workflowState.extractedContent = message.content;
      populateSoapFields(workflowState.extractedContent);
      updateStatus("SOAP note extracted", true);

      // Acknowledge receipt
      console.log(
        "%c[SLP-AI Sidebar] Sending success response",
        "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;"
      );
      sendResponse({ status: "success" });
      return true; // Keep the message channel open for the async response
    }
  });

  // Workflow Management Functions

  /**
   * Set the active workflow step
   * @param {number} stepNumber - The step number to activate (1-based)
   */
  function setActiveStep(stepNumber) {
    // Update workflow state
    workflowState.currentStep = stepNumber;

    // Update step indicators
    stepIndicators.forEach((indicator) => {
      const indicatorStep = parseInt(indicator.dataset.step);
      indicator.classList.remove("active", "completed");

      if (indicatorStep === stepNumber) {
        indicator.classList.add("active");
      } else if (indicatorStep < stepNumber) {
        indicator.classList.add("completed");
      }
    });

    // Show the active step, hide others
    workflowSteps.forEach((step) => {
      const stepId = step.id;
      const stepNum = parseInt(stepId.split("-")[1]);

      if (stepNum === stepNumber) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // Update status indicator text based on step
    const stepNames = ["Start", "SOAP Note", "Assessment", "Report"];
    updateStatus(`Step ${stepNumber}: ${stepNames[stepNumber - 1]}`, true);

    // Generate QR code when assessment step is shown
    if (stepNumber === 3) {
      // Wait a short time to ensure the DOM is ready
      setTimeout(generateAndDisplayQRCode, 300);
    }
  }

  /**
   * Populate the SOAP note fields with extracted content
   * @param {Object} content - The extracted page content
   */
  /**
   * Auto-fill patient information from extracted data
   */
  function autoFillPatientInfo(patientInfo) {
    if (!patientInfo) return;

    // Get the patient form elements
    const firstNameElement = document.getElementById("patientFirstName");
    const lastNameElement = document.getElementById("patientLastName");
    const birthDateElement = document.getElementById("patientBirthDate");

    if (!firstNameElement || !lastNameElement || !birthDateElement) {
      console.warn("Cannot auto-fill patient info: Form elements not found");
      return;
    }

    // Only fill in values if the fields are currently empty
    if (firstNameElement.value === "" && patientInfo.firstName) {
      firstNameElement.value = patientInfo.firstName;
    }

    if (lastNameElement.value === "" && patientInfo.lastName) {
      lastNameElement.value = patientInfo.lastName;
    }

    if (birthDateElement.value === "" && patientInfo.birthDate) {
      // Format the date if needed
      let formattedDate = patientInfo.birthDate;
      // Try to convert to YYYY-MM-DD format for input[type="date"]
      const dateMatch = patientInfo.birthDate.match(
        /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/
      );
      if (dateMatch) {
        // If the date is in MM/DD/YYYY format
        const month = dateMatch[1].padStart(2, "0");
        const day = dateMatch[2].padStart(2, "0");
        let year = dateMatch[3];
        // Handle 2-digit years
        if (year.length === 2) {
          year = (parseInt(year) > 50 ? "19" : "20") + year;
        }
        formattedDate = `${year}-${month}-${day}`;
      }

      birthDateElement.value = formattedDate;
    }

    console.log("Auto-filled patient information", patientInfo);
  }

  function populateSoapFields(content) {
    console.log(
      "%c[SLP-AI Sidebar] Populating SOAP fields with extracted content",
      "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
    );

    if (!content || !content.soapSections) {
      console.error(
        "%c[SLP-AI Sidebar] No SOAP sections found in content!",
        "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;"
      );
      return;
    }

    // Log what we received
    console.log(
      "%c[SLP-AI Sidebar] Received SOAP sections:",
      "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
    );
    console.log(
      "%c[SLP-AI Sidebar] Subjective sections: %d",
      "color: #3498db;",
      content.soapSections.subjective.length
    );
    console.log(
      "%c[SLP-AI Sidebar] Objective sections: %d",
      "color: #3498db;",
      content.soapSections.objective.length
    );
    console.log(
      "%c[SLP-AI Sidebar] Assessment sections: %d",
      "color: #3498db;",
      content.soapSections.assessment.length
    );
    console.log(
      "%c[SLP-AI Sidebar] Plan sections: %d",
      "color: #3498db;",
      content.soapSections.plan.length
    );

    // Get the textarea elements
    const subjectiveTextarea = document.getElementById("subjectiveContent");
    const objectiveTextarea = document.getElementById("objectiveContent");
    const assessmentTextarea = document.getElementById("assessmentContent");
    const planTextarea = document.getElementById("planContent");

    // Populate subjective section
    if (
      content.soapSections.subjective &&
      content.soapSections.subjective.length > 0
    ) {
      console.log(
        "%c[SLP-AI Sidebar] Populating subjective section with %d items",
        "color: #2ecc71;",
        content.soapSections.subjective.length
      );
      content.soapSections.subjective.forEach((section, i) => {
        console.log(
          `%c[SLP-AI Sidebar] Subjective item ${i + 1}: ${section.title}`,
          "color: #2ecc71;"
        );
        console.log(
          section.content.substring(0, 100) +
            (section.content.length > 100 ? "..." : "")
        );
      });

      subjectiveTextarea.value = content.soapSections.subjective
        .map((section) => section.content)
        .join("\n\n");
      workflowState.soapNote.data.subjective = subjectiveTextarea.value;
    } else {
      console.log(
        "%c[SLP-AI Sidebar] No subjective content to populate",
        "color: #e74c3c;"
      );
    }

    // Populate objective section
    if (
      content.soapSections.objective &&
      content.soapSections.objective.length > 0
    ) {
      console.log(
        "%c[SLP-AI Sidebar] Populating objective section with %d items",
        "color: #2ecc71;",
        content.soapSections.objective.length
      );
      content.soapSections.objective.forEach((section, i) => {
        console.log(
          `%c[SLP-AI Sidebar] Objective item ${i + 1}: ${section.title}`,
          "color: #2ecc71;"
        );
        console.log(
          section.content.substring(0, 100) +
            (section.content.length > 100 ? "..." : "")
        );
      });

      objectiveTextarea.value = content.soapSections.objective
        .map((section) => section.content)
        .join("\n\n");
      workflowState.soapNote.data.objective = objectiveTextarea.value;
    } else {
      console.log(
        "%c[SLP-AI Sidebar] No objective content to populate",
        "color: #e74c3c;"
      );
    }

    // Populate assessment section
    if (
      content.soapSections.assessment &&
      content.soapSections.assessment.length > 0
    ) {
      console.log(
        "%c[SLP-AI Sidebar] Populating assessment section with %d items",
        "color: #2ecc71;",
        content.soapSections.assessment.length
      );
      content.soapSections.assessment.forEach((section, i) => {
        console.log(
          `%c[SLP-AI Sidebar] Assessment item ${i + 1}: ${section.title}`,
          "color: #2ecc71;"
        );
        console.log(
          section.content.substring(0, 100) +
            (section.content.length > 100 ? "..." : "")
        );
      });

      assessmentTextarea.value = content.soapSections.assessment
        .map((section) => section.content)
        .join("\n\n");
      workflowState.soapNote.data.assessment = assessmentTextarea.value;
    } else {
      console.log(
        "%c[SLP-AI Sidebar] No assessment content to populate",
        "color: #e74c3c;"
      );
    }

    // Populate plan section
    if (content.soapSections.plan && content.soapSections.plan.length > 0) {
      console.log(
        "%c[SLP-AI Sidebar] Populating plan section with %d items",
        "color: #2ecc71;",
        content.soapSections.plan.length
      );
      content.soapSections.plan.forEach((section, i) => {
        console.log(
          `%c[SLP-AI Sidebar] Plan item ${i + 1}: ${section.title}`,
          "color: #2ecc71;"
        );
        console.log(
          section.content.substring(0, 100) +
            (section.content.length > 100 ? "..." : "")
        );
      });

      planTextarea.value = content.soapSections.plan
        .map((section) => section.content)
        .join("\n\n");
      workflowState.soapNote.data.plan = planTextarea.value;
    } else {
      console.log(
        "%c[SLP-AI Sidebar] No plan content to populate",
        "color: #e74c3c;"
      );
    }
  }

  /**
   * Save patient data to Firebase
   * @returns {Promise<string>} The patient UID
   */
  async function savePatientData() {
    try {
      // Get patient info from form
      const firstNameElement = document.getElementById("patientFirstName");
      const lastNameElement = document.getElementById("patientLastName");
      const birthDateElement = document.getElementById("patientBirthDate");

      if (!firstNameElement || !lastNameElement) {
        console.error("Patient form elements not found");
        return null;
      }

      const firstName = firstNameElement.value.trim();
      const lastName = lastNameElement.value.trim();
      const birthDate = birthDateElement ? birthDateElement.value : "";

      // Validate required fields
      if (!firstName || !lastName) {
        alert("Please enter patient first and last name");
        return null;
      }

      // Update workflow state
      workflowState.patient.firstName = firstName;
      workflowState.patient.lastName = lastName;
      workflowState.patient.birthDate = birthDate;

      // Get the authenticated user
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // Use the authenticated user's ID
      const providerUID = currentUser.uid;

      // Always use local storage for now to avoid Firebase permission issues
      const patientUID = workflowState.patient.uid || "local_" + Date.now();
      const patientData = {
        firstName: firstName,
        lastName: lastName,
        birthDate: birthDate,
        providerUID: providerUID,
        dateCreated: new Date().toISOString(),
      };

      // Store in local storage
      try {
        const localPatients = JSON.parse(
          localStorage.getItem("patients") || "{}"
        );
        localPatients[patientUID] = patientData;
        localStorage.setItem("patients", JSON.stringify(localPatients));

        // Update workflow state
        workflowState.patient.uid = patientUID;
        console.log("Patient data saved locally with ID:", patientUID);
      } catch (storageError) {
        console.error("Error saving to localStorage:", storageError);
      }

      // Try Firebase if available, but don't depend on it
      if (db && typeof db.collection === "function") {
        try {
          let patientRef;
          // Check if the patient UID is a Firebase ID or a local ID
          const isLocalId =
            workflowState.patient.uid &&
            workflowState.patient.uid.startsWith("local_");

          if (workflowState.patient.uid && !isLocalId) {
            // Update existing patient in Firebase
            patientRef = db
              .collection("patients")
              .doc(workflowState.patient.uid);
            await patientRef.update({
              firstName: firstName,
              lastName: lastName,
              birthDate: birthDate,
              providerUID: providerUID,
            });
            console.log(
              "Updated existing patient in Firebase with ID:",
              workflowState.patient.uid
            );
          } else {
            // Create new patient in Firebase (either no UID or local UID)
            patientRef = db.collection("patients").doc();
            await patientRef.set({
              firstName: firstName,
              lastName: lastName,
              birthDate: birthDate,
              providerUID: providerUID,
              dateCreated: new Date().toISOString(),
            });

            // If Firebase save was successful, update the UID
            if (patientRef && patientRef.id) {
              // Store the mapping between local ID and Firebase ID if needed
              if (isLocalId) {
                const localToFirebaseMap = JSON.parse(
                  localStorage.getItem("localToFirebaseMap") || "{}"
                );
                localToFirebaseMap[workflowState.patient.uid] = patientRef.id;
                localStorage.setItem(
                  "localToFirebaseMap",
                  JSON.stringify(localToFirebaseMap)
                );
              }

              // Update the workflow state with the Firebase ID
              workflowState.patient.uid = patientRef.id;
              console.log(
                "Patient data saved to Firebase with ID:",
                patientRef.id
              );
            }
          }
        } catch (firebaseError) {
          console.warn(
            "Firebase save failed, but local storage succeeded:",
            firebaseError
          );
          // We already saved to localStorage, so we can continue
        }
      }

      return workflowState.patient.uid;
    } catch (error) {
      console.error("Error in savePatientData:", error);

      // Create a fallback UID if all else fails
      const fallbackUID = "fallback_" + Date.now();
      workflowState.patient.uid = fallbackUID;

      return fallbackUID;
    }
  }

  /**
   * Save SOAP note data to Firebase
   * @param {string} patientUID - The patient UID
   * @returns {Promise<string>} The note UID
   */
  async function saveSoapNoteData(patientUID) {
    try {
      if (!patientUID) {
        console.error("Cannot save SOAP note: No patient UID provided");
        return null;
      }

      // Get SOAP data from textareas
      const subjective = document
        .getElementById("subjectiveContent")
        .value.trim();
      const objective = document
        .getElementById("objectiveContent")
        .value.trim();
      const assessment = document
        .getElementById("assessmentContent")
        .value.trim();
      const plan = document.getElementById("planContent").value.trim();

      // Update workflow state
      workflowState.soapNote.data.subjective = subjective;
      workflowState.soapNote.data.objective = objective;
      workflowState.soapNote.data.assessment = assessment;
      workflowState.soapNote.data.plan = plan;

      // Get the authenticated user
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // Use the authenticated user's ID
      const providerUID = currentUser.uid;

      // Create note object
      const noteData = {
        patientUID: patientUID,
        providerUID: [providerUID], // Array as per schema
        type: "soap",
        dateCreated: new Date().toISOString(),
        data: {
          subjective: subjective,
          objective: objective,
          assessment: assessment,
          plan: plan,
        },
      };

      // Check if Firebase is properly initialized
      if (!db || typeof db.collection !== "function") {
        console.warn("Firebase not available, using local storage instead");
        // Use local storage as fallback
        const noteUID =
          workflowState.soapNote.uid || "local_soap_" + Date.now();

        // Store in local storage
        const localNotes = JSON.parse(localStorage.getItem("notes") || "{}");
        localNotes[noteUID] = noteData;
        localStorage.setItem("notes", JSON.stringify(localNotes));

        // Update workflow state
        workflowState.soapNote.uid = noteUID;
        console.log("SOAP note saved locally with ID:", noteUID);
        return noteUID;
      }

      // Save to Firebase
      let noteRef;

      // Check if the note UID is a Firebase ID or a local ID
      const isLocalId =
        workflowState.soapNote.uid &&
        workflowState.soapNote.uid.startsWith("local_");

      if (workflowState.soapNote.uid && !isLocalId) {
        // Update existing note in Firebase
        noteRef = db.collection("notes").doc(workflowState.soapNote.uid);
        noteData.dateAmended = new Date().toISOString();
        await noteRef.update(noteData);
        console.log(
          "Updated existing SOAP note in Firebase with ID:",
          workflowState.soapNote.uid
        );
      } else {
        // Create new note in Firebase (either no UID or local UID)
        noteRef = db.collection("notes").doc();
        await noteRef.set(noteData);

        // Store the mapping between local ID and Firebase ID if needed
        if (isLocalId) {
          const localToFirebaseMap = JSON.parse(
            localStorage.getItem("localToFirebaseMap") || "{}"
          );
          localToFirebaseMap[workflowState.soapNote.uid] = noteRef.id;
          localStorage.setItem(
            "localToFirebaseMap",
            JSON.stringify(localToFirebaseMap)
          );
        }

        // Save the UID
        workflowState.soapNote.uid = noteRef.id;
      }

      console.log("SOAP note saved with ID:", noteRef.id);
      return noteRef.id;
    } catch (error) {
      console.error("Error saving SOAP note:", error);

      // Handle permission errors gracefully
      if (error.code === "permission-denied") {
        console.warn(
          "Firebase permission denied. Using local storage instead."
        );
        // Use local storage as fallback
        const noteUID = "local_soap_" + Date.now();
        const noteData = {
          patientUID: patientUID,
          providerUID: ["provider_" + Date.now().toString()],
          type: "soap",
          dateCreated: new Date().toISOString(),
          data: {
            subjective: workflowState.soapNote.data.subjective,
            objective: workflowState.soapNote.data.objective,
            assessment: workflowState.soapNote.data.assessment,
            plan: workflowState.soapNote.data.plan,
          },
        };

        // Store in local storage
        const localNotes = JSON.parse(localStorage.getItem("notes") || "{}");
        localNotes[noteUID] = noteData;
        localStorage.setItem("notes", JSON.stringify(localNotes));

        // Update workflow state
        workflowState.soapNote.uid = noteUID;
        return noteUID;
      } else {
        alert("Error saving SOAP note: " + error.message);
        return null;
      }
    }
  }

  /**
   * Save assessment data to Firebase
   * @param {string} patientUID - The patient UID
   * @returns {Promise<string>} The assessment UID
   */
  async function saveAssessmentData(patientUID) {
    try {
      if (!patientUID) {
        console.error("Cannot save assessment: No patient UID provided");
        return null;
      }

      // Get assessment type and results
      const assessmentType = document.getElementById("assessmentType").value;
      const assessmentResults = document
        .getElementById("assessmentResults")
        .value.trim();

      if (!assessmentResults) {
        alert("Please upload and process an assessment before continuing");
        return null;
      }

      // Update workflow state
      workflowState.assessment.type = assessmentType;
      workflowState.assessment.data = { results: assessmentResults };

      // Get the authenticated user
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // Use the authenticated user's ID
      const providerUID = currentUser.uid;

      // Create assessment object
      const assessmentData = {
        patientUID: patientUID,
        providerUID: [providerUID], // Array as per schema
        type: assessmentType,
        dateCreated:
          firebase && firebase.firestore
            ? firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString(),
        data: { results: assessmentResults },
      };

      // Save to Firebase
      let assessmentRef;

      if (workflowState.assessment.uid) {
        // Update existing assessment
        assessmentRef = db
          .collection("assessments")
          .doc(workflowState.assessment.uid);
        assessmentData.dateAmended =
          firebase && firebase.firestore
            ? firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
        await assessmentRef.update(assessmentData);
      } else {
        // Create new assessment
        assessmentRef = db.collection("assessments").doc();
        await assessmentRef.set(assessmentData);

        // Save the UID
        workflowState.assessment.uid = assessmentRef.id;
      }

      console.log("Assessment saved with ID:", assessmentRef.id);
      return assessmentRef.id;
    } catch (error) {
      console.error("Error saving assessment:", error);
      alert("Error saving assessment: " + error.message);
      return null;
    }
  }

  /**
   * Handle file upload for assessment
   * @param {File} file - The uploaded file
   */
  async function handleFileUpload(file) {
    try {
      if (!file) {
        console.error("No file provided");
        return;
      }

      // Update UI to show loading state
      const uploadFileBtn = document.getElementById("uploadFileBtn");
      uploadFileBtn.textContent = "Uploading...";
      uploadFileBtn.disabled = true;

      // In a real implementation, we would upload to Firebase Storage:
      // const storageRef = storage.ref();
      // const fileRef = storageRef.child(`assessments/${Date.now()}_${file.name}`);
      // await fileRef.put(file);
      // const downloadUrl = await fileRef.getDownloadURL();

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate AI analysis of the assessment
      const assessmentType = document.getElementById("assessmentType").value;
      const mockResults = generateMockAssessmentResults(assessmentType);

      // Update the assessment results textarea
      const assessmentResults = document.getElementById("assessmentResults");
      assessmentResults.value = mockResults;

      // Reset UI
      uploadFileBtn.textContent = "Choose File";
      uploadFileBtn.disabled = false;

      // Show success message
      updateStatus("Assessment processed successfully", true);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file: " + error.message);

      // Reset UI
      const uploadFileBtn = document.getElementById("uploadFileBtn");
      uploadFileBtn.textContent = "Choose File";
      uploadFileBtn.disabled = false;
    }
  }

  /**
   * Generate and display a QR code for assessment upload
   * @returns {Promise<void>}
   */
  async function generateAndDisplayQRCode() {
    try {
      // Check authentication first
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        alert(
          "Authentication is required to generate a QR code. Please log in and try again."
        );
        const qrCodeElement = document.getElementById("qrCode");
        qrCodeElement.innerHTML =
          "<div class='error-message'>Authentication required. Please log in.</div>";
        return;
      }

      // Get patient UID from workflowState
      const patientUID = workflowState.patient.uid;
      if (!patientUID) {
        const qrCodeElement = document.getElementById("qrCode");
        qrCodeElement.innerHTML =
          "<div class='error-message'>Please fill in patient information first.</div>";
        console.error('Cannot generate QR code: No patient UID found');
        return;
      }

      // Get the assessment type with PLS-5 as default
      const assessmentTypeElement = document.getElementById("assessmentType");
      const assessmentType = assessmentTypeElement.value || "PLS-5";
      if (!assessmentTypeElement.value) {
        assessmentTypeElement.value = "PLS-5";
      }
      const qrCodeElement = document.getElementById("qrCode");
      qrCodeElement.innerHTML = "<div class='qr-placeholder'>Generating QR code...</div>";

      // Check if token service is initialized
      if (!tokenService) {
        console.warn(
          "Token service not initialized yet. Trying again in 1 second..."
        );
        setTimeout(generateAndDisplayQRCode, 1000);
        return;
      }

      // Get current user
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // Generate a token with the authenticated user
      const tokenId = await tokenService.generateToken(
        assessmentType,
        currentUser.uid
      );

      // Save assessment with patient UID and token
      const assessmentData = {
        patientUID: patientUID,
        providerUID: currentUser.uid,
        tokenId: tokenId,
        type: assessmentType,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await saveAssessmentDataWithToken(assessmentData);

      // Create the QR code URL (use Netlify deployment)
      const qrCodeUrl = `https://statuesque-mooncake-00900f.netlify.app/?token=${tokenId}`;

      // Clear previous QR code
      qrCodeElement.innerHTML = "";

      try {
        // Create a div to hold the QR code
        const qrDiv = document.createElement("div");
        qrDiv.className = "qr-code-container";
        qrDiv.style.width = "200px";
        qrDiv.style.height = "200px";
        qrDiv.style.backgroundColor = "#ffffff";
        qrDiv.style.padding = "10px";
        qrDiv.style.borderRadius = "5px";
        qrDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
        qrCodeElement.appendChild(qrDiv);

        // Create a link element with the QR URL
        const link = document.createElement("a");
        link.href = qrCodeUrl;
        link.target = "_blank";
        link.textContent = "Open Assessment Upload Page";
        link.className = "qr-link";
        link.style.display = "block";
        link.style.marginTop = "10px";
        link.style.textAlign = "center";
        link.style.color = "#3498db";
        link.style.textDecoration = "none";
        link.style.fontWeight = "bold";
        qrCodeElement.appendChild(link);

        // Show a message about the QR code
        const message = document.createElement("div");
        message.className = "qr-message";
        message.textContent =
          "Scan this QR code or tap the link above to open the assessment upload page.";
        message.style.fontSize = "12px";
        message.style.marginTop = "10px";
        message.style.color = "#666";
        qrCodeElement.appendChild(message);

        // Try to use QRCode library if available
        if (
          typeof QRCode !== "undefined" &&
          typeof QRCode.toString === "function"
        ) {
          try {
            QRCode.toString(
              qrCodeUrl,
              { type: "svg", margin: 1, width: 200 },
              (err, svg) => {
                if (!err) {
                  qrDiv.innerHTML = svg;
                }
              }
            );
          } catch (qrError) {
            console.warn("Could not generate QR code SVG:", qrError);
            qrDiv.textContent = "Scan QR code to upload assessment";
          }
        } else {
          qrDiv.textContent = "Scan QR code to upload assessment";
        }
      } catch (renderError) {
        console.error("Error rendering QR code alternative:", renderError);
      }

      // Add a caption
      const caption = document.createElement("p");
      caption.className = "small-text";
      caption.textContent =
        "Scan this QR code with your mobile device to upload an assessment";
      qrCodeElement.appendChild(caption);

      console.log("QR code generated for token:", tokenId);

      // In the QR code workflow, after token is generated and displayed, listen for scores:
      listenForAssessmentScores(tokenId);
    } catch (error) {
      console.error("Error generating QR code:", error);
      const qrCodeElement = document.getElementById("qrCode");
      qrCodeElement.innerHTML =
        "<div class='error-message'>Error generating QR code. Please try again.</div>";
    }
  }

  // Helper to save assessment with token and patient UID
  async function saveAssessmentDataWithToken(assessmentData) {
    if (!assessmentData.patientUID) {
      throw new Error('Cannot save assessment: No patient UID provided');
    }
    // Save to Firestore
    await db.collection('assessments').add(assessmentData);
  }

  /**
   * Generate mock assessment results based on assessment type
   * @param {string} assessmentType - The type of assessment
   * @returns {string} Mock assessment results
   */
  function generateMockAssessmentResults(assessmentType) {
    const results = {
      "PLS-5":
        "Preschool Language Scales - 5th Edition\n\nTotal Language Score: 95 (Average)\nAuditory Comprehension: 92 (Average)\nExpressive Communication: 98 (Average)\n\nStrengths:\n- Strong vocabulary recognition\n- Good understanding of basic concepts\n\nAreas for Development:\n- Complex sentence structures\n- Following multi-step directions",

      "REEL-4":
        "Receptive-Expressive Emergent Language Test - 4th Edition\n\nReceptive Language Age Equivalent: 36 months\nExpressive Language Age Equivalent: 30 months\nCombined Language Age Equivalent: 33 months\n\nNotes:\n- Receptive language skills are developing appropriately\n- Expressive language shows slight delay in sentence formation",

      "CLEF-4":
        "Clinical Evaluation of Language Fundamentals - 4th Edition\n\nCore Language Score: 88 (Low Average)\nReceptive Language Index: 92 (Average)\nExpressive Language Index: 85 (Low Average)\nLanguage Structure Index: 90 (Average)\n\nRecommendations:\n- Target expressive language development\n- Work on narrative skills and complex syntax",

      GFTA: "Goldman-Fristoe Test of Articulation\n\nTotal Raw Score: 15\nPercentile Rank: 35th\n\nPhonological Processes Observed:\n- Final consonant deletion\n- Cluster reduction\n- Stopping of fricatives\n\nSounds in error:\n- /s/ in all positions\n- /r/ in initial and medial positions\n- /l/ blends",
    };

    return (
      results[assessmentType] || "No results available for this assessment type"
    );
  }
  /**
   * Check if user is authenticated and prompt for login if not
   * @returns {Promise<boolean>} Whether the user is authenticated
   */
  async function checkAuthentication() {
    try {
      if (!firebase || !firebase.auth) {
        console.warn("Firebase auth not initialized");
        return false;
      }

      // Check if user is already logged in
      const currentUser = firebase.auth().currentUser;
      if (currentUser) {
        console.log("User already authenticated:", currentUser.email);
        return true;
      }

      // Show login prompt
      const loginConfirmed = confirm(
        "You need to be logged in to use this feature. Would you like to log in now?"
      );

      if (loginConfirmed) {
        // Show login modal
        return await showLoginModal();
      }

      return false;
    } catch (error) {
      console.error("Authentication error:", error);
      return false;
    }
  }

  /**
   * Show a login modal with options for Google or Email/Password authentication
   * @returns {Promise<boolean>} Whether the login was successful
   */
  async function showLoginModal() {
    // Create modal container
    const modalContainer = document.createElement("div");
    modalContainer.className = "login-modal-container";
    modalContainer.style.position = "fixed";
    modalContainer.style.top = "0";
    modalContainer.style.left = "0";
    modalContainer.style.width = "100%";
    modalContainer.style.height = "100%";
    modalContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modalContainer.style.display = "flex";
    modalContainer.style.justifyContent = "center";
    modalContainer.style.alignItems = "center";
    modalContainer.style.zIndex = "1000";

    // Create modal content
    const modalContent = document.createElement("div");
    modalContent.className = "login-modal-content";
    modalContent.style.backgroundColor = "white";
    modalContent.style.padding = "20px";
    modalContent.style.borderRadius = "5px";
    modalContent.style.width = "300px";
    modalContent.style.maxWidth = "90%";

    // Create modal header
    const modalHeader = document.createElement("div");
    modalHeader.innerHTML = `<h2 style="margin-top: 0; text-align: center;">Sign In</h2>`;

    // Create tabs for sign in and sign up
    const tabContainer = document.createElement("div");
    tabContainer.style.display = "flex";
    tabContainer.style.marginBottom = "20px";
    tabContainer.style.borderBottom = "1px solid #ddd";

    const signInTab = document.createElement("div");
    signInTab.textContent = "Sign In";
    signInTab.style.padding = "10px 15px";
    signInTab.style.cursor = "pointer";
    signInTab.style.borderBottom = "2px solid #4285f4";
    signInTab.style.fontWeight = "bold";
    signInTab.dataset.tab = "signin";

    const signUpTab = document.createElement("div");
    signUpTab.textContent = "Sign Up";
    signUpTab.style.padding = "10px 15px";
    signUpTab.style.cursor = "pointer";
    signUpTab.style.borderBottom = "2px solid transparent";
    signUpTab.dataset.tab = "signup";

    tabContainer.appendChild(signInTab);
    tabContainer.appendChild(signUpTab);

    // Create login form
    const loginForm = document.createElement("div");
    loginForm.id = "signinForm";
    loginForm.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label for="email" style="display: block; margin-bottom: 5px;">Email</label>
        <input type="email" id="email" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="password" style="display: block; margin-bottom: 5px;">Password</label>
        <input type="password" id="password" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <button id="emailSignIn" style="width: 100%; padding: 10px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign In</button>
      </div>
      <div style="text-align: center; margin-bottom: 15px;">OR</div>
      <div>
        <button id="googleSignIn" style="width: 100%; padding: 10px; background-color: #db4437; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <span style="margin-right: 10px;">Sign in with Google</span>
        </button>
      </div>
    `;

    // Create sign up form
    const signupForm = document.createElement("div");
    signupForm.id = "signupForm";
    signupForm.style.display = "none";
    signupForm.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label for="signupEmail" style="display: block; margin-bottom: 5px;">Email</label>
        <input type="email" id="signupEmail" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="signupPassword" style="display: block; margin-bottom: 5px;">Password</label>
        <input type="password" id="signupPassword" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="firstName" style="display: block; margin-bottom: 5px;">First Name</label>
        <input type="text" id="firstName" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="lastName" style="display: block; margin-bottom: 5px;">Last Name</label>
        <input type="text" id="lastName" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label for="organization" style="display: block; margin-bottom: 5px;">Organization</label>
        <input type="text" id="organization" style="width: 100%; padding: 8px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 15px;">
        <button id="emailSignUp" style="width: 100%; padding: 10px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign Up</button>
      </div>
    `;

    // Create error message element
    const errorMessage = document.createElement("div");
    errorMessage.id = "loginError";
    errorMessage.style.color = "red";
    errorMessage.style.marginTop = "10px";
    errorMessage.style.textAlign = "center";
    errorMessage.style.display = "none";

    // Append elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(tabContainer);
    modalContent.appendChild(loginForm);
    modalContent.appendChild(signupForm);
    modalContent.appendChild(errorMessage);
    modalContainer.appendChild(modalContent);

    // Add modal to document
    document.body.appendChild(modalContainer);

    // Return a promise that resolves when authentication is complete
    return new Promise((resolve) => {
      // Handle tab switching
      signInTab.addEventListener("click", () => {
        signInTab.style.borderBottom = "2px solid #4285f4";
        signInTab.style.fontWeight = "bold";
        signUpTab.style.borderBottom = "2px solid transparent";
        signUpTab.style.fontWeight = "normal";
        loginForm.style.display = "block";
        signupForm.style.display = "none";
        errorMessage.style.display = "none";
      });

      signUpTab.addEventListener("click", () => {
        signUpTab.style.borderBottom = "2px solid #4285f4";
        signUpTab.style.fontWeight = "bold";
        signInTab.style.borderBottom = "2px solid transparent";
        signInTab.style.fontWeight = "normal";
        signupForm.style.display = "block";
        loginForm.style.display = "none";
        errorMessage.style.display = "none";
      });

      // Handle email/password sign in
      const emailSignInBtn = document.getElementById("emailSignIn");
      emailSignInBtn.addEventListener("click", async () => {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Validate inputs
        if (!email || !password) {
          const errorEl = document.getElementById("loginError");
          errorEl.textContent = "Please enter both email and password";
          errorEl.style.display = "block";
          return;
        }

        try {
          // Attempt to sign in with email and password
          await firebase.auth().signInWithEmailAndPassword(email, password);
          document.body.removeChild(modalContainer);
          resolve(true);
        } catch (error) {
          const errorEl = document.getElementById("loginError");
          errorEl.textContent = error.message || "Failed to sign in";
          errorEl.style.display = "block";
        }
      });

      // Handle email/password sign up
      const emailSignUpBtn = document.getElementById("emailSignUp");
      emailSignUpBtn.addEventListener("click", async () => {
        const email = document.getElementById("signupEmail").value;
        const password = document.getElementById("signupPassword").value;
        const firstName = document.getElementById("firstName").value;
        const lastName = document.getElementById("lastName").value;
        const organization = document.getElementById("organization").value;

        // Validate inputs
        if (!email || !password || !firstName || !lastName) {
          const errorEl = document.getElementById("loginError");
          errorEl.textContent = "Please fill in all required fields";
          errorEl.style.display = "block";
          return;
        }

        try {
          // Create user with email and password
          const userCredential = await firebase
            .auth()
            .createUserWithEmailAndPassword(email, password);

          // Update profile with display name
          await userCredential.user.updateProfile({
            displayName: `${firstName} ${lastName}`,
          });

          // Create user document in Firestore
          const userDocRef = firebase
            .firestore()
            .collection("users")
            .doc(userCredential.user.uid);
          await userDocRef.set({
            firstName: firstName,
            lastName: lastName,
            email: email,
            organization: organization || "",
            admin: false,
            devMode: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });

          document.body.removeChild(modalContainer);
          resolve(true);
        } catch (error) {
          const errorEl = document.getElementById("loginError");
          errorEl.textContent = error.message || "Failed to sign up";
          errorEl.style.display = "block";
        }
      });

      // Handle Google sign in
      const googleSignInBtn = document.getElementById("googleSignIn");
      googleSignInBtn.addEventListener("click", async () => {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          const userCredential = await firebase
            .auth()
            .signInWithPopup(provider);

          // Check if this is a new user and create Firestore document if needed
          if (userCredential.additionalUserInfo?.isNewUser) {
            const user = userCredential.user;
            const displayNameParts = user.displayName?.split(" ") || ["", ""];
            const firstName = displayNameParts[0] || "";
            const lastName = displayNameParts.slice(1).join(" ") || "";

            // Create user document in Firestore
            const userDocRef = firebase
              .firestore()
              .collection("users")
              .doc(user.uid);
            await userDocRef.set({
              firstName: firstName,
              lastName: lastName,
              email: user.email || "",
              organization: "",
              admin: false,
              devMode: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          }

          document.body.removeChild(modalContainer);
          resolve(true);
        } catch (error) {
          const errorEl = document.getElementById("loginError");
          errorEl.textContent =
            error.message || "Failed to sign in with Google";
          errorEl.style.display = "block";
        }
      });

      // Close modal when clicking outside
      modalContainer.addEventListener("click", (event) => {
        if (event.target === modalContainer) {
          document.body.removeChild(modalContainer);
          resolve(false);
        }
      });
    });
  }

  // Initialize event handlers
  function initWorkflowEventHandlers() {
    // Get references to all buttons
    const createReportBtn = document.getElementById("createReportBtn");
    const extractSoapBtn = document.getElementById("extractSoapBtn");
    const uploadFileBtn = document.getElementById("uploadFileBtn");
    const fileInput = document.getElementById("fileInput");
    const soapPrevBtn = document.getElementById("soapPrevBtn");
    const soapNextBtn = document.getElementById("soapNextBtn");
    const assessmentPrevBtn = document.getElementById("assessmentPrevBtn");
    const assessmentNextBtn = document.getElementById("assessmentNextBtn");

    // Report generation elements
    const generateReportBtn = document.getElementById("generateReportBtn");
    const reportSectionsContainer = document.getElementById(
      "reportSectionsContainer"
    );
    const reportSectionsContent = document.getElementById(
      "reportSectionsContent"
    );
    const exportReportBtn = document.getElementById("exportReportBtn");
    const reportBackBtn = document.getElementById("reportBackBtn");
    const startOverBtn = document.getElementById("startOverBtn");

    // Step indicators click handlers
    stepIndicators.forEach((indicator) => {
      indicator.addEventListener("click", () => {
        const step = parseInt(indicator.dataset.step);
        if (step <= workflowState.currentStep) {
          setActiveStep(step);
        }
      });
    });

    // STEP 1: Create Report button
    if (createReportBtn) {
      createReportBtn.addEventListener("click", async () => {
        // Check authentication first
        const isAuthenticated = await checkAuthentication();
        if (isAuthenticated) {
          setActiveStep(2);
        } else {
          alert(
            "Authentication is required to create a report. Please log in and try again."
          );
        }
      });
    }

    /**
     * Request content script injection for the active tab
     * @returns {Promise<boolean>} True if injection was successful
     */
    async function ensureContentScriptLoaded() {
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tabs || !tabs[0] || !tabs[0].id) {
          throw new Error("No active tab found");
        }

        const activeTab = tabs[0];

        // Try to send a simple ping message to check if content script is loaded
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "ping" },
            (response) => {
              // If there's a runtime error, the content script isn't loaded
              if (chrome.runtime.lastError) {
                console.log(
                  "%c[SLP-AI Sidebar] Content script not loaded, requesting injection",
                  "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;"
                );

                // Request the background script to inject the content script
                chrome.runtime.sendMessage(
                  {
                    target: "background",
                    action: "injectContentScript",
                    tabId: activeTab.id,
                  },
                  (injectionResponse) => {
                    if (
                      chrome.runtime.lastError ||
                      (injectionResponse && injectionResponse.error)
                    ) {
                      console.error(
                        "%c[SLP-AI Sidebar] Failed to inject content script:",
                        "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
                        chrome.runtime.lastError || injectionResponse.error
                      );
                      reject(new Error("Failed to inject content script"));
                    } else {
                      console.log(
                        "%c[SLP-AI Sidebar] Content script injection successful",
                        "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;"
                      );
                      resolve(true);
                    }
                  }
                );
              } else {
                // Content script is already loaded
                console.log(
                  "%c[SLP-AI Sidebar] Content script is already loaded",
                  "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;"
                );
                resolve(true);
              }
            }
          );
        });
      } catch (error) {
        console.error(
          "%c[SLP-AI Sidebar] Error ensuring content script is loaded:",
          "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
          error
        );
        throw error;
      }
    }

    // STEP 2: Extract SOAP Note button
    if (extractSoapBtn) {
      extractSoapBtn.addEventListener("click", async () => {
        try {
          console.log(
            "%c[SLP-AI Sidebar] Extract SOAP button clicked",
            "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;"
          );

          // Update button state
          extractSoapBtn.textContent = "Extracting...";
          extractSoapBtn.disabled = true;

          // Make sure content script is loaded before proceeding
          try {
            await ensureContentScriptLoaded();
          } catch (injectionError) {
            console.error(
              "Failed to ensure content script is loaded:",
              injectionError
            );
            throw new Error(
              "Content script could not be loaded. Please reload the page and try again."
            );
          }

          // Request content extraction from the active tab
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const activeTab = tabs[0];

          if (!activeTab) {
            throw new Error("No active tab found");
          }

          // Send message to content script with proper error handling
          console.log(
            "%c[SLP-AI Sidebar] Sending extractPageContent request to tab ID: %d",
            "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
            activeTab.id
          );
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "extractPageContent" },
            (response) => {
              // Check for chrome runtime error (indicates content script not ready)
              if (chrome.runtime.lastError) {
                console.error(
                  "%c[SLP-AI Sidebar] Content script error:",
                  "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
                  chrome.runtime.lastError
                );
                extractSoapBtn.textContent = "Extract SOAP Note";
                extractSoapBtn.disabled = false;
                alert(
                  "Error: Content script not ready. Please reload the page and try again."
                );
                return;
              }

              // Log the response
              console.log(
                "%c[SLP-AI Sidebar] Response from content script:",
                "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;",
                response
              );

              if (response && response.success === false) {
                console.error(
                  "%c[SLP-AI Sidebar] Error in content script:",
                  "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
                  response.error
                );
                extractSoapBtn.textContent = "Extract SOAP Note";
                extractSoapBtn.disabled = false;
                alert("Error extracting content: " + response.error);
                return;
              }

              // If we get here, message was sent successfully
              console.log(
                "%c[SLP-AI Sidebar] Message sent to content script successfully",
                "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;"
              );
            }
          );
        } catch (error) {
          console.error(
            "%c[SLP-AI Sidebar] Error initiating content extraction:",
            "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
            error
          );
          extractSoapBtn.textContent = "Extract SOAP Note";
          extractSoapBtn.disabled = false;
          alert("Error extracting content: " + error.message);
        }
      });
    }

    // SOAP Note navigation buttons
    if (soapPrevBtn) {
      soapPrevBtn.addEventListener("click", () => {
        setActiveStep(1);
      });
    }

    if (soapNextBtn) {
      soapNextBtn.addEventListener("click", async () => {
        // Save patient data
        const patientUID = await savePatientData();
        if (!patientUID) return;

        // Save SOAP note
        const noteUID = await saveSoapNoteData(patientUID);
        if (!noteUID) return;

        // Move to next step, but ensure patient data is saved before generating QR
        await proceedToAssessment();
      });
    }

    // Add proceedToAssessment function to ensure patient data is saved before QR code
    async function proceedToAssessment() {
      try {
        // Save patient data again to ensure latest info (optional, can be removed if redundant)
        const patientUID = workflowState.patient.uid || await savePatientData();
        if (!patientUID) {
          throw new Error('Failed to save patient data');
        }
        // Move to assessment step
        setActiveStep(3); // This will trigger QR code generation after DOM is ready
      } catch (error) {
        console.error('Error proceeding to assessment:', error);
        if (typeof showErrorMessage === 'function') {
          showErrorMessage('Please try again - patient data not saved properly');
        } else {
          alert('Please try again - patient data not saved properly');
        }
      }
    }

    // STEP 3: File upload button
    if (uploadFileBtn && fileInput) {
      uploadFileBtn.addEventListener("click", () => {
        fileInput.click();
      });

      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (file) {
          await handleFileUpload(file);
        }
      });
    }

    // QR code generation when assessment type changes
    const assessmentType = document.getElementById("assessmentType");
    if (assessmentType) {
      assessmentType.addEventListener("change", generateAndDisplayQRCode);
    }

    // Assessment navigation buttons
    if (assessmentPrevBtn) {
      assessmentPrevBtn.addEventListener("click", () => {
        setActiveStep(2);
      });
    }

    if (assessmentNextBtn) {
      assessmentNextBtn.addEventListener("click", async () => {
        // Save assessment data
        const patientUID = workflowState.patient.uid;
        const assessmentUID = await saveAssessmentData(patientUID);
        if (!assessmentUID) return;

        // Move to next step
        setActiveStep(4);
      });
    }

    // STEP 4: Generate Report button
    if (generateReportBtn) {
      generateReportBtn.addEventListener("click", async () => {
        try {
          generateReportBtn.textContent = "Generating...";
          generateReportBtn.disabled = true;

          // Get patient data from Step 2 form (robust selectors and null checks)
          const firstNameField = document.querySelector('[name="firstName"]') || document.querySelector('#firstName') || document.querySelector('.first-name');
          const lastNameField = document.querySelector('[name="lastName"]') || document.querySelector('#lastName') || document.querySelector('.last-name');
          const dateOfBirthField = document.querySelector('[name="dateOfBirth"]') || document.querySelector('#dateOfBirth') || document.querySelector('.date-of-birth');
          console.log('Form fields found:', {
            firstName: firstNameField,
            lastName: lastNameField,
            dateOfBirth: dateOfBirthField
          });
          if (!firstNameField || !lastNameField || !dateOfBirthField) {
            throw new Error('Patient form fields not found. Please fill in patient information first.');
          }
          const firstName = firstNameField.value || 'Not provided';
          const lastName = lastNameField.value || 'Not provided';
          const dateOfBirth = dateOfBirthField.value || 'Not provided';

          // Get current PLS-5 scores from Step 3
          function getCurrentAssessmentScores() {
            const assessmentResults = document.getElementById("assessmentResults").value;
            // Try to parse the scores from the textarea (assumes format from previous steps)
            const scores = {};
            assessmentResults.split('\n').forEach(line => {
              const [label, value] = line.split(":");
              if (label && value) {
                const key = label.trim().replace(/ /g, "").toLowerCase();
                scores[key] = value.trim().replace(/[^0-9.]/g, "");
              }
            });
            return {
              auditoryComprehension: scores["auditorycomprehension"] || "",
              expressiveCommunication: scores["expressivecommunication"] || "",
              totalLanguage: scores["totallanguage"] || "",
              percentileRank: scores["percentilerank"] || ""
            };
          }
          const currentScores = getCurrentAssessmentScores();

          // Call OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer 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`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "gpt-4",
              messages: [{
                role: "user",
                content: `Generate a professional PLS-5 bilingual evaluation report:\n\nPatient: ${firstName} ${lastName}\nDOB: ${dateOfBirth}\nAssessment Date: ${new Date().toLocaleDateString()}\n\nPLS-5 Results:\n- Auditory Comprehension: ${currentScores.auditoryComprehension}\n- Expressive Communication: ${currentScores.expressiveCommunication}\n- Total Language: ${currentScores.totalLanguage}\n- Percentile Rank: ${currentScores.percentileRank}%\n\nGenerate professional bilingual speech-language evaluation with clinical interpretation and recommendations.`
              }]
            })
          });

          const result = await response.json();
          const report = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content
            ? result.choices[0].message.content
            : "Error: No report generated.";

          // Display in Step 4
          let reportBox = document.getElementById('generatedReport');
          if (!reportBox) {
            reportBox = document.createElement('textarea');
            reportBox.id = 'generatedReport';
            reportBox.style.width = '100%';
            reportBox.style.height = '400px';
            reportBox.style.marginTop = '16px';
            reportBox.style.fontSize = '1rem';
            reportBox.style.padding = '12px';
            reportBox.style.border = '1px solid #ccc';
            reportBox.style.borderRadius = '4px';
            const step4Container = document.querySelector('.workflow-step.active') || document.body;
            step4Container.appendChild(reportBox);
          }
          reportBox.value = report;

          generateReportBtn.textContent = "Regenerate Report";
          generateReportBtn.disabled = false;
        } catch (error) {
          console.error("Report generation failed:", error);
          generateReportBtn.textContent = "Generate Report";
          generateReportBtn.disabled = false;
          alert("Error generating report: " + error.message);
        }
      });
    }

    // Export Report button
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", () => {
        try {
          // Collect the edited content from textareas and tables
          const reportContent = {};
          ReportService.reportSections.forEach((section) => {
            if (section.type === "table" && section.tableData) {
              // Handle table data
              const tableData = {
                rows: [],
              };

              // Collect data from each row
              section.tableData.rows.forEach((row) => {
                const rowData = {
                  name: row.name,
                  date: "",
                  selectedOptions: [],
                };

                // Get date
                const dateInput = document.getElementById(
                  `${section.id}-${row.id}-date`
                );
                if (dateInput) {
                  rowData.date = dateInput.value;
                }

                // Get selected options
                row.options.forEach((option, index) => {
                  const checkbox = document.getElementById(
                    `${section.id}-${row.id}-option-${index}`
                  );
                  if (checkbox && checkbox.checked) {
                    rowData.selectedOptions.push(option);
                  }
                });

                tableData.rows.push(rowData);
              });

              // Get notes
              const notesTextarea = document.getElementById(
                `report-section-${section.id}-notes`
              );
              if (notesTextarea) {
                tableData.notes = notesTextarea.value;
                reportContent[`${section.id}Notes`] = notesTextarea.value;
                workflowState.report.sections[`${section.id}Notes`] =
                  notesTextarea.value;
              }

              reportContent[section.id] = tableData;
              workflowState.report.sections[section.id] = tableData;
            } else {
              // Handle regular text sections
              const textarea = document.getElementById(
                `report-section-${section.id}`
              );
              if (textarea) {
                reportContent[section.id] = textarea.value;
                // Update the workflow state with edited content
                workflowState.report.sections[section.id] = textarea.value;
              }
            }
          });

          // Update the generation timestamp
          workflowState.report.dateGenerated = new Date().toISOString();

          // Convert to HTML
          const html = ReportService.convertToHTML(reportContent);

          // Generate filename with patient name and date
          const patientName =
            workflowState.patient.firstName && workflowState.patient.lastName
              ? `${workflowState.patient.lastName}_${workflowState.patient.firstName}`
              : "Patient";
          const date = new Date().toISOString().split("T")[0];
          const filename = `SLP_Report_${patientName}_${date}.doc`;

          // Download as Word document
          ReportService.downloadAsWord(html, filename);
        } catch (error) {
          console.error("Error exporting report:", error);
          alert("Error exporting report: " + error.message);
        }
      });
    }

    // Report Back button
    if (reportBackBtn) {
      reportBackBtn.addEventListener("click", () => {
        setActiveStep(3);
      });
    }

    // Start Over button
    if (startOverBtn) {
      startOverBtn.addEventListener("click", () => {
        if (
          confirm(
            "Are you sure you want to start over? All unsaved data will be lost."
          )
        ) {
          resetWorkflow();
        }
      });
    }
  }

  /**
   * Display report sections for editing
   * @param {Object} reportContent - The generated report content
   */
  function displayReportSections(reportContent) {
    // Clear previous content
    reportSectionsContent.innerHTML = "";

    // Create section elements
    ReportService.reportSections.forEach((section) => {
      const sectionDiv = document.createElement("div");
      sectionDiv.className = "report-section";

      const headerDiv = document.createElement("div");
      headerDiv.className = "report-section-header";

      const title = document.createElement("h5");
      title.className = "report-section-title";
      title.textContent = section.title;

      headerDiv.appendChild(title);
      sectionDiv.appendChild(headerDiv);

      // Handle different section types
      if (section.type === "table" && section.tableData) {
        // Create a table element for the screening results
        const tableContainer = document.createElement("div");
        tableContainer.className = "report-table-container";

        // Create the table
        const table = document.createElement("table");
        table.className = "report-table";
        table.id = `report-table-${section.id}`;

        // Create table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        section.tableData.headers.forEach((headerText) => {
          const th = document.createElement("th");
          th.textContent = headerText;
          headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement("tbody");

        section.tableData.rows.forEach((row) => {
          const tr = document.createElement("tr");

          // First column: Screening type
          const tdName = document.createElement("td");
          tdName.textContent = row.name;
          tr.appendChild(tdName);

          // Second column: Date input
          const tdDate = document.createElement("td");
          const dateInput = document.createElement("input");
          dateInput.type = "date";
          dateInput.id = `${section.id}-${row.id}-date`;
          dateInput.className = "report-date-input";
          tdDate.appendChild(dateInput);
          tr.appendChild(tdDate);

          // Third column: Options with checkboxes
          const tdOptions = document.createElement("td");
          tdOptions.className = "report-options-cell";

          row.options.forEach((option, index) => {
            const optionDiv = document.createElement("div");
            optionDiv.className = "report-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `${section.id}-${row.id}-option-${index}`;
            checkbox.className = "report-checkbox";
            checkbox.value = option;

            const label = document.createElement("label");
            label.htmlFor = checkbox.id;
            label.textContent = option;

            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            tdOptions.appendChild(optionDiv);
          });

          tr.appendChild(tdOptions);
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        sectionDiv.appendChild(tableContainer);

        // Add a notes textarea for additional information
        const notesTextarea = document.createElement("textarea");
        notesTextarea.className = "report-section-textarea";
        notesTextarea.id = `report-section-${section.id}-notes`;
        notesTextarea.placeholder =
          "Additional notes about screening results...";
        notesTextarea.value = reportContent[`${section.id}Notes`] || "";
        sectionDiv.appendChild(notesTextarea);
      } else {
        // Regular text section
        const textarea = document.createElement("textarea");
        textarea.className = "report-section-textarea";
        textarea.id = `report-section-${section.id}`;
        textarea.value = reportContent[section.id] || "";
        textarea.placeholder = `Enter ${section.title.toLowerCase()} here...`;
        sectionDiv.appendChild(textarea);
      }

      reportSectionsContent.appendChild(sectionDiv);
    });
  }

  /**
   * Reset the workflow to the initial state
   */
  function resetWorkflow() {
    // Reset workflow state
    workflowState.currentStep = 1;
    workflowState.patient = {
      firstName: "",
      lastName: "",
      birthDate: "",
      uid: null,
    };
    workflowState.soapNote = {
      patientUID: null,
      providerUID: null,
      type: "soap",
      dateCreated: null,
      dateAmended: null,
      data: {
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
      },
    };
    workflowState.assessment = {
      patientUID: null,
      providerUID: null,
      type: null,
      dateCreated: null,
      dateAmended: null,
      data: {},
    };
    workflowState.report = {
      patientUID: null,
      dateGenerated: null,
      sections: {},
    };
    workflowState.extractedContent = null;

    // Reset form fields
    const patientFirstName = document.getElementById("patientFirstName");
    const patientLastName = document.getElementById("patientLastName");
    const patientBirthDate = document.getElementById("patientBirthDate");
    const subjectiveContent = document.getElementById("subjectiveContent");
    const objectiveContent = document.getElementById("objectiveContent");
    const assessmentContent = document.getElementById("assessmentContent");
    const planContent = document.getElementById("planContent");
    const assessmentResults = document.getElementById("assessmentResults");

    if (patientFirstName) patientFirstName.value = "";
    if (patientLastName) patientLastName.value = "";
    if (patientBirthDate) patientBirthDate.value = "";
    if (subjectiveContent) subjectiveContent.value = "";
    if (objectiveContent) objectiveContent.value = "";
    if (assessmentContent) assessmentContent.value = "";
    if (planContent) planContent.value = "";
    if (assessmentResults) assessmentResults.value = "";

    // Reset report sections
    if (reportSectionsContainer) {
      reportSectionsContainer.style.display = "none";
    }
    if (reportSectionsContent) {
      reportSectionsContent.innerHTML = "";
    }
    if (generateReportBtn) {
      generateReportBtn.textContent = "Generate Report";
      generateReportBtn.disabled = false;
    }

    // Reset to step 1
    setActiveStep(1);
  }

  /**
   * Update the status indicator
   * @param {string} message - Status message to display
   * @param {boolean} success - Whether the status is a success or error
   */
  function updateStatus(message, success = true) {
    if (!statusIndicator) return;

    statusIndicator.textContent = message;
    statusIndicator.className = success ? "status success" : "status error";
  }

  // Initialize Firebase with fallback for local testing
  let db;
  let storage;
  let firebase;
  let tokenService;

  try {
    // Initialize Firebase if it's defined
    if (typeof window.firebase !== "undefined") {
      firebase = window.firebase;
      db = firebase.firestore();
      storage = firebase.storage();
      console.log("Firebase services initialized");

      // Initialize token service
      import("../services/token-service.js")
        .then((module) => {
          const TokenService = module.default;
          tokenService = new TokenService(firebase);
          console.log("Token service initialized");
        })
        .catch((error) => {
          console.error("Error loading token service:", error);
        });
    } else {
      console.warn(
        "Firebase is not defined. Running in mock mode with simulated behavior."
      );

      // Create mock Firebase implementation for local testing
      db = createMockFirestore();
      storage = createMockStorage();
      firebase = { firestore: () => db };
    }
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    // Create mock implementations
    db = createMockFirestore();
    storage = createMockStorage();
  }

  /**
   * Create a mock Firestore implementation for local testing
   * @returns {Object} A mock Firestore object
   */
  function createMockFirestore() {
    const mockDb = {
      _collections: {},
      collection: function (name) {
        if (!this._collections[name]) {
          this._collections[name] = {
            _docs: {},
            doc: function (id) {
              const docId =
                id ||
                "doc_" +
                  Date.now() +
                  "_" +
                  Math.random().toString(36).substr(2, 9);
              if (!this._docs[docId]) {
                this._docs[docId] = {
                  id: docId,
                  _data: {},
                  set: function (data) {
                    this._data = { ...data };
                    console.log(
                      `Mock Firestore: Document ${docId} set in ${name}`,
                      data
                    );
                    return Promise.resolve();
                  },
                  update: function (data) {
                    this._data = { ...this._data, ...data };
                    console.log(
                      `Mock Firestore: Document ${docId} updated in ${name}`,
                      data
                    );
                    return Promise.resolve();
                  },
                  get: function () {
                    return Promise.resolve({
                      exists: Object.keys(this._data).length > 0,
                      data: () => this._data,
                      id: this.id,
                    });
                  },
                };
              }
              return this._docs[docId];
            },
          };
        }
        return this._collections[name];
      },
    };
    return mockDb;
  }

  /**
   * Create a mock Storage implementation for local testing
   * @returns {Object} A mock Storage object
   */
  function createMockStorage() {
    return {
      ref: function () {
        return {
          child: function (path) {
            return {
              put: function (file) {
                console.log(
                  `Mock Storage: File ${file.name} uploaded to ${path}`
                );
                return Promise.resolve();
              },
              getDownloadURL: function () {
                return Promise.resolve(`https://mock-storage-url.com/${path}`);
              },
            };
          },
        };
      },
    };
  }

  // Initialize the application
  initWorkflowEventHandlers();

  /**
   * Creates extraction control elements for the sidebar
   * @returns {HTMLElement} The extraction controls container
   */
  function createExtractionControls() {
    const controls = document.createElement("div");
    controls.className = "extraction-controls";
    controls.innerHTML = `
            <div class="control-heading">Extraction Mode</div>
            <div class="control-options">
                <label class="control-option">
                    <input type="radio" name="extractionMode" value="auto" checked>
                    <span>Auto Detect</span>
                </label>
                <label class="control-option">
                    <input type="radio" name="extractionMode" value="soap">
                    <span>SOAP Notes</span>
                </label>
                <label class="control-option">
                    <input type="radio" name="extractionMode" value="general">
                    <span>General Content</span>
                </label>
            </div>
        `;

    // Add change listener
    controls
      .querySelectorAll('input[name="extractionMode"]')
      .forEach((radio) => {
        radio.addEventListener("change", function () {
          extractionMode = this.value;
          if (pageContent) {
            displayPageContent(pageContent);
          }
        });
      });

    return controls;
  }

  // Add extraction controls to the page - do this after DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    // Get the preview container again to ensure it's loaded
    const previewContainer = document.getElementById("previewContainer");

    if (previewContainer) {
      // Create the extraction controls
      const extractionControls = createExtractionControls();

      // Insert before the preview container if it has a parent
      if (previewContainer.parentElement) {
        previewContainer.parentElement.insertBefore(
          extractionControls,
          previewContainer
        );
      } else {
        // If no parent, just append to the body
        document.body.appendChild(extractionControls);
      }
    } else {
      console.warn("Preview container not found");
    }
  });

  // Update status indicator
  function updateStatus(text, isReady = true) {
    const statusDot = statusIndicator.querySelector(".status-dot");
    const statusText = statusIndicator.querySelector(".status-text");
    statusDot.style.background = isReady ? "#4CAF50" : "#ff4444";
    statusText.textContent = text;
  }

  // Display extracted page content
  function displayPageContent(content) {
    if (!content) return;

    // Get the preview container - it might have been created after initial load
    const previewContainer = document.getElementById("previewContainer");
    if (!previewContainer) {
      console.warn("Cannot display content: Preview container not found");
      return;
    }

    try {
      // Clear previous content
      previewContainer.innerHTML = "";

      // Add page info
      const pageInfoElement = document.createElement("div");
      pageInfoElement.className = "page-info";
      pageInfoElement.innerHTML = `
              <h4>Page Information</h4>
              <div class="info-item"><strong>Title:</strong> ${
                content.title || "No title"
              }</div>
              <div class="info-item"><strong>URL:</strong> ${truncateText(
                content.url || "No URL",
                40
              )}</div>
              <div class="info-item"><strong>Extracted:</strong> ${new Date(
                content.timestamp || Date.now()
              ).toLocaleString()}</div>
          `;
      previewContainer.appendChild(pageInfoElement);

      // Choose content to display based on mode
      if (
        extractionMode === "soap" ||
        (extractionMode === "auto" && hasSoapContent(content))
      ) {
        displaySoapContent(content);
      } else {
        displayGeneralContent(content);
      }

      // Add dates if found
      if (content.dates && content.dates.length > 0) {
        displayDates(content.dates);
      }

      // Add fields if found
      if (content.inputFields && content.inputFields.length > 0) {
        displayInputFields(content.inputFields);
      }
    } catch (error) {
      console.error("Error displaying page content:", error);

      // Try to show a simple error message in the container
      try {
        previewContainer.innerHTML = `<div class="error-message">Error displaying content: ${error.message}</div>`;
      } catch (e) {
        console.error("Could not even display error message:", e);
      }
    }
  }

  // Check if the content has SOAP structure
  function hasSoapContent(content) {
    return (
      content.soapSections &&
      (content.soapSections.subjective.length > 0 ||
        content.soapSections.objective.length > 0 ||
        content.soapSections.assessment.length > 0 ||
        content.soapSections.plan.length > 0)
    );
  }

  // Display SOAP-structured content
  function displaySoapContent(content) {
    try {
      // Get the preview container again to ensure it's available
      const previewContainer = document.getElementById("previewContainer");
      if (!previewContainer) {
        console.warn(
          "Cannot display SOAP content: Preview container not found"
        );
        return;
      }

      // Auto-fill patient information if available
      if (content.patientInfo) {
        autoFillPatientInfo(content.patientInfo);
      }

      const soapElement = document.createElement("div");
      soapElement.className = "soap-content";

      // Make sure content.soapSections exists
      if (!content.soapSections) {
        soapElement.innerHTML = `<h4>SOAP Structure</h4><div class="error-message">No SOAP sections found in content</div>`;
        previewContainer.appendChild(soapElement);
        return;
      }

      soapElement.innerHTML = `
              <h4>SOAP Structure</h4>
              <div class="soap-sections">
                  ${createSoapSection(
                    "Subjective",
                    content.soapSections.subjective || []
                  )}
                  ${createSoapSection(
                    "Objective",
                    content.soapSections.objective || []
                  )}
                  ${createSoapSection(
                    "Assessment",
                    content.soapSections.assessment || []
                  )}
                  ${createSoapSection("Plan", content.soapSections.plan || [])}
              </div>
          `;

      previewContainer.appendChild(soapElement);

      // Add expand/collapse functionality
      soapElement.querySelectorAll(".soap-section-header").forEach((header) => {
        header.addEventListener("click", () => {
          const content = header.nextElementSibling;
          if (content) {
            content.classList.toggle("collapsed");
            header.classList.toggle("collapsed");
          }
        });
      });
    } catch (error) {
      console.error("Error displaying SOAP content:", error);
    }
  }

  // Create a SOAP section
  function createSoapSection(title, sections) {
    try {
      if (!sections || sections.length === 0) {
        return `
                  <div class="soap-section">
                      <div class="soap-section-header">${title}</div>
                      <div class="soap-section-content collapsed">
                          <p class="no-content">No ${title} content found</p>
                      </div>
                  </div>
              `;
      }

      return `
              <div class="soap-section">
                  <div class="soap-section-header">${title}</div>
                  <div class="soap-section-content">
                      ${sections
                        .map((section) => {
                          try {
                            return `
                              <div class="content-item">
                                  <h5>${section.title || "Untitled"}</h5>
                                  <p>${section.content || "No content"}</p>
                              </div>
                              `;
                          } catch (err) {
                            console.error("Error mapping section:", err);
                            return '<div class="content-item error">Error displaying section</div>';
                          }
                        })
                        .join("")}
                  </div>
              </div>
          `;
    } catch (error) {
      console.error(`Error creating ${title} section:`, error);
      return `
              <div class="soap-section error">
                  <div class="soap-section-header">${title}</div>
                  <div class="soap-section-content collapsed">
                      <p class="error-content">Error displaying ${title} content</p>
                  </div>
              </div>
          `;
    }
  }

  // Display general content
  function displayGeneralContent(content) {
    try {
      // Get the preview container again to ensure it's available
      const previewContainer = document.getElementById("previewContainer");
      if (!previewContainer) {
        console.warn(
          "Cannot display general content: Preview container not found"
        );
        return;
      }

      const generalElement = document.createElement("div");
      generalElement.className = "general-content";

      // Create a header for general content
      generalElement.innerHTML = `<h4>Page Content</h4>`;

      try {
        // Add general content if available
        if (content.generalContent && content.generalContent.length > 0) {
          const contentList = document.createElement("div");
          contentList.className = "content-list";

          content.generalContent.forEach((item) => {
            try {
              if (item && typeof item === "object") {
                const contentItem = document.createElement("div");
                contentItem.className = "content-item";
                contentItem.innerHTML = `<p>${
                  item.text || "No text available"
                }</p>`;
                contentList.appendChild(contentItem);
              }
            } catch (itemError) {
              console.error("Error processing content item:", itemError);
            }
          });

          generalElement.appendChild(contentList);
        } else if (content.sections && content.sections.length > 0) {
          // Fallback to sections if no general content
          const contentList = document.createElement("div");
          contentList.className = "content-list";

          content.sections.forEach((section) => {
            try {
              if (section && typeof section === "object") {
                const contentItem = document.createElement("div");
                contentItem.className = "content-item";
                contentItem.innerHTML = `
                          <h5>${section.title || "Untitled"}</h5>
                          <p>${section.content || "No content available"}</p>
                      `;
                contentList.appendChild(contentItem);
              }
            } catch (sectionError) {
              console.error("Error processing section:", sectionError);
            }
          });

          generalElement.appendChild(contentList);
        } else {
          // No content available
          const noContent = document.createElement("div");
          noContent.className = "no-content";
          noContent.textContent = "No content available";
          generalElement.appendChild(noContent);
        }
      } catch (contentError) {
        console.error("Error processing content:", contentError);
        const errorMsg = document.createElement("div");
        errorMsg.className = "error-message";
        errorMsg.textContent = "Error processing content";
        generalElement.appendChild(errorMsg);
      }

      previewContainer.appendChild(generalElement);
    } catch (error) {
      console.error("Error displaying general content:", error);
    }
  }

  // Display dates found in the content
  function displayDates(dates) {
    if (!dates || dates.length === 0) return;

    const datesElement = document.createElement("div");
    datesElement.className = "dates-content";
    datesElement.innerHTML = `
            <h4>Dates Found</h4>
            <div class="dates-list">
                ${dates
                  .map((date) => `<span class="date-chip">${date}</span>`)
                  .join("")}
            </div>
        `;

    previewContainer.appendChild(datesElement);
  }

  // Display input fields found on the page
  function displayInputFields(fields) {
    if (!fields || fields.length === 0) return;

    const fieldsElement = document.createElement("div");
    fieldsElement.className = "fields-content";
    fieldsElement.innerHTML = `
            <h4>Form Fields</h4>
            <div class="fields-list">
                ${fields
                  .map(
                    (field) => `
                    <div class="field-item ${field.soapCategory || ""}">
                        <div class="field-header">
                            <span class="field-label">${
                              field.label || "Unnamed Field"
                            }</span>
                            ${
                              field.soapCategory
                                ? `<span class="field-category">${
                                    field.soapCategory.charAt(0).toUpperCase() +
                                    field.soapCategory.slice(1)
                                  }</span>`
                                : ""
                            }
                        </div>
                        <div class="field-type">${field.type}</div>
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;

    previewContainer.appendChild(fieldsElement);
  }

  // Helper function to truncate text
  function truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  // Add click handler for test button
  if (testButton) {
    testButton.addEventListener("click", () => {
      // Request page content extraction with error handling
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          try {
            // Update button text and status
            testButton.textContent = "Analyzing...";
            testButton.disabled = true;
            updateStatus("Analyzing page...", true);

            // Send message with error handling
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "extractPageContent" },
              (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                  console.error("Error messaging content script:", error);
                  updateStatus(
                    "Error: Content script not ready. Reload the page.",
                    false
                  );
                  console.log("Attempting to add system message");

                  // Only try to add message if chatHistory exists
                  if (chatHistory) {
                    addMessage(
                      "system",
                      "Error: Cannot connect to the page. Try reloading the current page."
                    );
                  } else {
                    console.warn(
                      "Cannot add system message: chatHistory not found"
                    );
                  }

                  // Reset button
                  testButton.textContent = "Analyze Page";
                  testButton.disabled = false;
                }
              }
            );
          } catch (err) {
            console.error("Error analyzing page:", err);
            updateStatus("Error analyzing page", false);

            // Reset button
            testButton.textContent = "Analyze Page";
            testButton.disabled = false;
          }
        } else {
          updateStatus("No active tab found", false);
        }
      });
    });
  }

  // Add click handler for send button
  sendButton?.addEventListener("click", handleSend);

  // Add enter key handler for input
  userInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Function to handle sending messages
  function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage("user", message);
    userInput.value = "";

    // Prepare context from page content
    let context = "";
    if (pageContent) {
      // Build context based on extraction mode
      if (
        extractionMode === "soap" ||
        (extractionMode === "auto" && hasSoapContent(pageContent))
      ) {
        context = buildSoapContext(pageContent);
      } else {
        context = buildGeneralContext(pageContent);
      }
    }

    // Send message with context to AI service (mock for now)
    setTimeout(() => {
      addMessage(
        "assistant",
        `I'll help you with your request. I've analyzed the page and found ${
          context ? "some relevant content" : "no specific content"
        }. What would you like to do with this information?`
      );
    }, 500);
  }

  // Build context string from SOAP content
  function buildSoapContext(content) {
    let contextParts = [];

    // Add SOAP sections
    Object.entries(content.soapSections).forEach(([type, sections]) => {
      if (sections.length > 0) {
        const sectionTexts = sections
          .map((s) => `${s.title}: ${truncateText(s.content, 100)}`)
          .join("; ");
        contextParts.push(`${type.toUpperCase()}: ${sectionTexts}`);
      }
    });

    // Add dates if found
    if (content.dates && content.dates.length > 0) {
      contextParts.push(`Dates: ${content.dates.join(", ")}`);
    }

    return contextParts.join("\n");
  }

  // Build context string from general content
  function buildGeneralContext(content) {
    let contextParts = [];

    // Add title
    contextParts.push(`Title: ${content.title}`);

    // Add general content summary
    if (content.generalContent && content.generalContent.length > 0) {
      const summary = content.generalContent
        .slice(0, 5)
        .map((item) => truncateText(item.text, 100))
        .join("\n");
      contextParts.push(`Content: ${summary}`);
    }

    return contextParts.join("\n");
  }

  // Function to add message to chat history
  function addMessage(type, content) {
    // Check if chatHistory element exists, create if missing
    let chatHistoryEl = document.getElementById("chatHistory");
    if (!chatHistoryEl) {
      chatHistoryEl = document.createElement("div");
      chatHistoryEl.id = "chatHistory";
      chatHistoryEl.style.maxHeight = "200px";
      chatHistoryEl.style.overflowY = "auto";
      chatHistoryEl.style.border = "1px solid #eee";
      chatHistoryEl.style.margin = "8px 0";
      chatHistoryEl.style.padding = "8px";
      // Try to insert before userInput or at end of body
      const userInputEl = document.getElementById("userInput");
      if (userInputEl && userInputEl.parentElement) {
        userInputEl.parentElement.insertBefore(chatHistoryEl, userInputEl);
      } else {
        document.body.appendChild(chatHistoryEl);
      }
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    // Support for markdown-like formatting
    if (type === "assistant") {
      messageDiv.innerHTML = formatMessage(content);
    } else {
      messageDiv.textContent = content;
    }

    // Add timestamp
    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestamp);

    chatHistoryEl.appendChild(messageDiv);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  }

  // Simple markdown-like formatting
  function formatMessage(text) {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Lists
    text = text.replace(/^- (.*)/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
    // Paragraphs
    text = text.replace(/\n\n/g, "<br><br>");
    return text;
  }

  // Add welcome message
  addMessage(
    "assistant",
    "Hello! I'm analyzing the current page to help you extract relevant content. You can use this information to generate reports or other documentation."
  );

  // In the QR code workflow, after token is generated and displayed, listen for scores:
  function listenForAssessmentScores(tokenId) {
    if (firebase.firestore && typeof firebase.firestore === 'function') {
      firebase.firestore().collection('assessments').doc(tokenId)
        .onSnapshot((doc) => {
          if (doc.exists && doc.data()?.completed) {
            const scores = doc.data();
            console.log('Scores received:', scores); // DEBUG
            displayAssessmentResults(scores);
            enableSaveAndNextButton();
          }
        });
    } else {
      console.error('No Firebase Firestore available.');
    }
  }

  function enableSaveAndNextButton() {
    const saveButton = document.getElementById('assessmentNextBtn');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Save & Next';
    }
  }
  // Call listenForAssessmentScores(tokenId) after QR code is generated and tokenId is available.

  // Add or update this function near the bottom of the file
  function displayAssessmentResults(scores) {
    const assessmentResults = document.getElementById("assessmentResults");
    console.log('[DEBUG] displayAssessmentResults called. Element found:', !!assessmentResults, 'Scores:', scores);
    if (!assessmentResults) return;
    // Format scores for display
    if (scores && typeof scores === 'object') {
      let resultText = '';
      if (scores.auditoryComprehension) resultText += `Auditory Comprehension: ${scores.auditoryComprehension}\n`;
      if (scores.expressiveCommunication) resultText += `Expressive Communication: ${scores.expressiveCommunication}\n`;
      if (scores.totalLanguage) resultText += `Total Language: ${scores.totalLanguage}\n`;
      if (scores.percentileRank) resultText += `Percentile Rank: ${scores.percentileRank}\n`;
      // Add any other fields
      for (const key in scores) {
        if (!['auditoryComprehension','expressiveCommunication','totalLanguage','percentileRank'].includes(key)) {
          resultText += `${key}: ${scores[key]}\n`;
        }
      }
      assessmentResults.value = resultText.trim();
    } else if (typeof scores === 'string') {
      assessmentResults.value = scores;
    }
  }

  // ... existing code ...
  // Remove dynamic creation of the PLS-5 download button and instead attach the event to the static #pls5DownloadBtn in Step 4

  document.addEventListener("DOMContentLoaded", async () => {
    // ... existing code ...

    // ... after all other DOM element queries ...
    const pls5DownloadBtn = document.getElementById('pls5DownloadBtn');
    if (pls5DownloadBtn) {
      pls5DownloadBtn.addEventListener('click', () => {
        // Gather patient and assessment info
        const firstName = workflowState.patient.firstName || '';
        const lastName = workflowState.patient.lastName || '';
        const dob = workflowState.patient.birthDate || '';
        const date = new Date().toLocaleDateString();
        const scores = document.getElementById('assessmentResults')?.value || '';
        // Nicely formatted PLS-5 report template
        const report = `==============================\nPLS-5 BILINGUAL EVALUATION REPORT\n==============================\n\nPATIENT INFORMATION\n------------------\nName: ${firstName} ${lastName}\nDate of Birth: ${dob}\nAssessment Date: ${date}\n\nPLS-5 RESULTS\n-------------\n${scores}\n\nCLINICAL INTERPRETATION\n-----------------------\n[Insert interpretation here]\n\nRECOMMENDATIONS\n---------------\n[Insert recommendations here]\n\n==============================\nEnd of Report\n==============================\n`;
        console.log('[PLS5 Download] Downloading report:', report);
        // Download as .doc
        const blob = new Blob([report], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PLS-5_Report_${lastName}_${firstName}_${date}.doc`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      });
    }
  });

  // ... existing code ...
  const generateReportBtn = document.getElementById('generateReportBtn');
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', () => {
      console.log('[Generate Report] Button clicked');
      // Gather patient and assessment info
      const firstName = workflowState.patient.firstName || '';
      const lastName = workflowState.patient.lastName || '';
      const dob = workflowState.patient.birthDate || '';
      const date = new Date().toLocaleDateString();
      const scores = document.getElementById('assessmentResults')?.value || '';

      // Try to get user-provided clinical interpretation and recommendations if present
      let clinicalInterpretation = '';
      let recommendations = '';
      const interpretationBox = document.getElementById('clinicalInterpretation');
      const recommendationsBox = document.getElementById('recommendations');
      if (interpretationBox && interpretationBox.value.trim()) {
        clinicalInterpretation = interpretationBox.value.trim();
      } else {
        clinicalInterpretation = 'The child demonstrates age-appropriate receptive and expressive language skills. No significant language disorder is present at this time.';
      }
      if (recommendationsBox && recommendationsBox.value.trim()) {
        recommendations = recommendationsBox.value.trim();
      } else {
        recommendations = 'Continue to monitor language development. Provide language-rich activities at home and consider re-evaluation in 6-12 months.';
      }

      // Try to get user-provided strengths and weaknesses if present
      let strengths = '';
      let weaknesses = '';
      const strengthsBox = document.getElementById('areasOfStrength');
      const weaknessesBox = document.getElementById('areasOfWeakness');
      if (strengthsBox && strengthsBox.value.trim()) {
        strengths = strengthsBox.value.trim();
      } else {
        strengths = 'Strong vocabulary recognition; Good understanding of basic concepts; Age-appropriate social communication.';
      }
      if (weaknessesBox && weaknessesBox.value.trim()) {
        weaknesses = weaknessesBox.value.trim();
      } else {
        weaknesses = 'Difficulty with complex sentence structures; Needs support following multi-step directions; Mild articulation errors.';
      }

      // Beautiful HTML PLS-5 report template with tables and strengths/weaknesses
      const reportHtml = `
        <html>
        <head>
          <meta charset='UTF-8'>
          <title>PLS-5 Bilingual Evaluation Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
            h1 { text-align: center; color: #4B2991; }
            h2 { color: #4B2991; border-bottom: 2px solid #eee; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th, td { border: 1px solid #bbb; padding: 8px 12px; text-align: left; }
            th { background: #f3f0fa; color: #4B2991; }
            .section { margin-bottom: 32px; }
            .section-title { font-size: 1.1em; color: #4B2991; margin-bottom: 8px; }
            .recommend, .interpret, .strengths, .weaknesses {
              background: #f9f7fd;
              border-left: 4px solid #4B2991;
              padding: 12px;
              margin-bottom: 16px;
              box-shadow: 0 2px 8px #e5e1f7;
              border-radius: 6px;
            }
            .strengths { border-color: #2ecc71; background: #f6fcf7; }
            .weaknesses { border-color: #e67e22; background: #fff8f2; }
          </style>
        </head>
        <body>
          <h1>PLS-5 Bilingual Evaluation Report</h1>
          <div class='section'>
            <h2>Patient Information</h2>
            <table>
              <tr><th>Name</th><td>${firstName} ${lastName}</td></tr>
              <tr><th>Date of Birth</th><td>${dob}</td></tr>
              <tr><th>Assessment Date</th><td>${date}</td></tr>
            </table>
          </div>
          <div class='section'>
            <h2>PLS-5 Results</h2>
            <table>
              <tr><th>Auditory Comprehension</th><td>${scores.match(/Auditory Comprehension: (.*)/)?.[1] || '-'}</td></tr>
              <tr><th>Expressive Communication</th><td>${scores.match(/Expressive Communication: (.*)/)?.[1] || '-'}</td></tr>
              <tr><th>Total Language</th><td>${scores.match(/Total Language: (.*)/)?.[1] || '-'}</td></tr>
              <tr><th>Percentile Rank</th><td>${scores.match(/Percentile Rank: (.*)/)?.[1] || '-'}</td></tr>
            </table>
          </div>
          <div class='section'>
            <h2>Areas of Strength</h2>
            <div class='strengths'>${strengths}</div>
          </div>
          <div class='section'>
            <h2>Areas of Weakness</h2>
            <div class='weaknesses'>${weaknesses}</div>
          </div>
          <div class='section'>
            <h2>Clinical Interpretation</h2>
            <div class='interpret'>${clinicalInterpretation}</div>
          </div>
          <div class='section'>
            <h2>Recommendations</h2>
            <div class='recommend'>${recommendations}</div>
          </div>
        </body>
        </html>
      `;
      // Download as .doc
      const blob = new Blob([reportHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PLS-5_Report_${lastName}_${firstName}_${date}.doc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }
  // ... existing code ...
});
