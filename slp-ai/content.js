// Create hover button
function createHoverButton() {
    const button = document.createElement('button');
    button.id = 'slp-ai-hover-button';
    button.innerHTML = 'AI';
    button.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 50px;
        height: 50px;
        border-radius: 25px;
        background: #1a73e8;
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        display: none;
    `;
    return button;
}

// Inject the sidecar and hover button into the page
function initializeUI() {
    // Create and inject sidecar
    const sidecarContainer = document.createElement('div');
    sidecarContainer.id = 'slp-ai-assistant-sidecar';
    sidecarContainer.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: 300px;
        height: 100vh;
        background-color: white;
        box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        z-index: 10000;
        display: none;
    `;

    // Add content to sidecar
    sidecarContainer.innerHTML = `
        <div style="padding: 20px;">
            <h2>SLP AI Assistant</h2>
            <p>Sidebar UI placeholder</p>
            <div style="margin-top: 20px;">
                <button id="testButton" style="padding: 10px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Test Button
                </button>
            </div>
        </div>
    `;

    // Create and inject hover button
    const hoverButton = createHoverButton();
    
    // Add elements to page
    document.body.appendChild(sidecarContainer);
    document.body.appendChild(hoverButton);

    // Add click handler for test button
    document.getElementById('testButton')?.addEventListener('click', () => {
        console.log('Test button clicked');
        alert('Test button clicked - UI is working!');
    });

    // Add click handler for hover button
    hoverButton.addEventListener('click', () => {
        const sidecar = document.getElementById('slp-ai-assistant-sidecar');
        if (sidecar) {
            const isCurrentlyVisible = sidecar.style.display === 'block';
            sidecar.style.display = isCurrentlyVisible ? 'none' : 'block';
            console.log('Toggled sidecar visibility via hover button');
        }
    });

    return { sidecarContainer, hoverButton };
}

// Initialize UI elements
const { sidecarContainer, hoverButton } = initializeUI();

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    sendResponse({ success: true });
    return true;
}); 