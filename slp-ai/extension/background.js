// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  console.log("%c[SLP-AI Background] Extension installed/updated", "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;");
  chrome.storage.local.set({
    isEnabled: true,
  });

  // Set default panel behavior
  if (chrome?.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }
});

// Set up message listener for communication between content script and sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("%c[SLP-AI Background] Received message:", "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;", message);
  console.log("%c[SLP-AI Background] Message sender:", "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;", sender);

  // Handle content script injection request
  if (
    message.target === "background" &&
    message.action === "injectContentScript"
  ) {
    console.log(
      "Received request to inject content script into tab:",
      message.tabId
    );

    if (!message.tabId) {
      console.error("No tab ID provided for content script injection");
      sendResponse({ error: "No tab ID provided" });
      return true;
    }

    injectContentScript(message.tabId)
      .then(() => {
        console.log("Content script injection successful via message");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error injecting content script via message:", error);
        sendResponse({ error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Handle OpenAI API requests
  if (message.target === "openai") {
    console.log("Processing OpenAI API request");

    // Make the API request from the background script
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${message.apiKey}`,
      },
      body: JSON.stringify(message.data),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("OpenAI API response received");
        sendResponse({ success: true, data: data });
      })
      .catch((error) => {
        console.error("Error calling OpenAI API:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Forward messages between content script and sidebar
  if (message.target === "content") {
    // Forward to content script
    console.log("%c[SLP-AI Background] Forwarding message to content script", "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;");
    console.log("%c[SLP-AI Background] Message data:", "color: #9b59b6;", message.data);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        console.log("%c[SLP-AI Background] Sending to tab ID: %d", "color: #9b59b6;", tabs[0].id);
        chrome.tabs
          .sendMessage(tabs[0].id, message.data)
          .then((response) => {
            console.log("%c[SLP-AI Background] Response from content script:", "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;", response);
            
            // Additional debugging for extractPageContent response
            if (message.data && message.data.action === "extractPageContent" && response) {
              console.log("%c[SLP-AI Background] Extract page content response:", "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;");
              console.log("%c[SLP-AI Background] Response success: %s", "color: #9b59b6;", response.success ? "Yes" : "No");
              
              if (response.data && response.data.soapSections) {
                console.log("%c[SLP-AI Background] SOAP sections in response: %s", "color: #9b59b6;", "Yes");
                console.log("%c[SLP-AI Background] Subjective sections: %d", "color: #9b59b6;", response.data.soapSections.subjective?.length || 0);
                console.log("%c[SLP-AI Background] Objective sections: %d", "color: #9b59b6;", response.data.soapSections.objective?.length || 0);
                console.log("%c[SLP-AI Background] Assessment sections: %d", "color: #9b59b6;", response.data.soapSections.assessment?.length || 0);
                console.log("%c[SLP-AI Background] Plan sections: %d", "color: #9b59b6;", response.data.soapSections.plan?.length || 0);
              } else {
                console.log("%c[SLP-AI Background] No SOAP sections in response!", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;");
              }
            }
            
            sendResponse(response);
          })
          .catch((error) => {
            console.error("%c[SLP-AI Background] Error sending message to content script:", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;", error);
            // Try to inject the content script and retry
            injectContentScript(tabs[0].id)
              .then(() => {
                // Retry sending the message after injection
                return chrome.tabs.sendMessage(tabs[0].id, message.data);
              })
              .then((response) => {
                console.log(
                  "%c[SLP-AI Background] Response from content script after injection:",
                  "background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;",
                  response
                );
                sendResponse(response);
              })
              .catch((retryError) => {
                console.error(
                  "%c[SLP-AI Background] Error after content script injection:",
                  "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;",
                  retryError
                );
                sendResponse({
                  error:
                    "Failed to communicate with the page. Please reload the page.",
                });
              });
          });
      } else {
        console.error("%c[SLP-AI Background] No active tab found", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;");
        sendResponse({ error: "No active tab found" });
      }
    });
    return true; // Keep the message channel open for async response
  }

  if (message.target === "sidebar") {
    // Forward to sidebar
    console.log("%c[SLP-AI Background] Forwarding message to sidebar", "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;");
    console.log("%c[SLP-AI Background] Message data:", "color: #2ecc71;", message.data);
    
    // Log message structure for debugging
    if (message.data && message.data.action === "pageContentExtracted") {
      console.log("%c[SLP-AI Background] Message action: pageContentExtracted", "color: #2ecc71;");
      console.log("%c[SLP-AI Background] Content present: %s", "color: #2ecc71;", message.data.content ? "Yes" : "No");
      
      if (message.data.content && message.data.content.soapSections) {
        console.log("%c[SLP-AI Background] SOAP sections present: %s", "color: #2ecc71;", "Yes");
        console.log("%c[SLP-AI Background] Subjective sections: %d", "color: #2ecc71;", message.data.content.soapSections.subjective?.length || 0);
        console.log("%c[SLP-AI Background] Objective sections: %d", "color: #2ecc71;", message.data.content.soapSections.objective?.length || 0);
        console.log("%c[SLP-AI Background] Assessment sections: %d", "color: #2ecc71;", message.data.content.soapSections.assessment?.length || 0);
        console.log("%c[SLP-AI Background] Plan sections: %d", "color: #2ecc71;", message.data.content.soapSections.plan?.length || 0);
      } else {
        console.log("%c[SLP-AI Background] SOAP sections missing!", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;");
      }
    }
    
    chrome.runtime
      .sendMessage(message.data)
      .then((response) => {
        console.log("%c[SLP-AI Background] Response from sidebar:", "background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;", response);
        sendResponse(response);
      })
      .catch((error) => {
        console.error("%c[SLP-AI Background] Error sending message to sidebar:", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;", error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  // Check if tab is valid
  if (!tab?.url) {
    console.log("Invalid tab or URL");
    return;
  }

  // Don't open on chrome:// pages
  if (tab.url.startsWith("chrome://")) {
    console.log("Cannot open side panel on chrome:// pages");
    return;
  }

  try {
    const currentWindow = await chrome.windows.getCurrent();

    // Enable side panel for this tab
    await chrome.sidePanel.setOptions({
      path: "sidebar/sidebar.html",
      enabled: true,
    });

    // Open the panel in the current window
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    console.log("Side panel opened successfully");
  } catch (error) {
    console.error("Error handling click:", error);
  }
});

// Function to inject the content script into a tab
async function injectContentScript(tabId) {
  console.log("%c[SLP-AI Background] Injecting content script into tab: %d", "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;", tabId);
  try {
    // First inject AI service which is a dependency
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["services/ai-service.js"],
    });

    // Then inject the main content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });

    // Inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["styles.css"],
    });

    console.log("%c[SLP-AI Background] Content script injection successful", "background: #f39c12; color: white; padding: 2px 5px; border-radius: 3px;");
    return true;
  } catch (error) {
    console.error("%c[SLP-AI Background] Error injecting content script:", "background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;", error);
    throw error;
  }
}

// Listen for tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject when the tab has completed loading
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") // Exclude extension pages
  ) {
    console.log("Tab updated, injecting content script:", tabId);
    injectContentScript(tabId).catch((error) => {
      console.error("Failed to inject content script on tab update:", error);
    });
  }
});
