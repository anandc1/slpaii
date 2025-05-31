class PromptService {
  static templates = {
    summary: {
      template: `[first-name] is a [age] old [gender] who was referred for an evaluation due to concerns with [concerns]. Based on the result of [assessment-type] assessment, parent report, and clinical judgment, [first-name] presented with [diagnosis]. [first-name] communicates primarily through [communication-methods]. Social-pragmatics skills were [social-skills-status] as observed by [observations]. Given these results, it is recommended that [first-name] [treatment] to functionally communicate [goals].`,
      requiredFields: [
        { key: 'first-name', label: 'Patient First Name', type: 'phi' },
        { key: 'age', label: 'Age', type: 'phi' },
        { key: 'gender', label: 'Gender', type: 'phi' },
        { key: 'concerns', label: 'Primary Concerns', type: 'clinical' },
        { key: 'assessment-type', label: 'Assessment Type', type: 'clinical' },
        { key: 'diagnosis', label: 'Diagnosis', type: 'clinical' },
        { key: 'communication-methods', label: 'Communication Methods', type: 'observation' },
        { key: 'social-skills-status', label: 'Social Skills Status', type: 'observation' },
        { key: 'observations', label: 'Clinical Observations', type: 'observation' },
        { key: 'treatment', label: 'Treatment Recommendations', type: 'clinical' },
        { key: 'goals', label: 'Treatment Goals', type: 'clinical' }
      ]
    }
    // Add more templates as needed
  };

  static disclaimers = {
    phi: "Please enter patient information - AI will not generate PHI",
    clinical: "Provider input required for clinical judgment",
    observation: "Based on clinical observation"
  };

  static async generateResponse(field, context) {
    const template = this.identifyTemplate(field, context);
    if (!template) {
      return this.generateGenericResponse(field, context);
    }

    const promptData = await this.gatherPromptData(template);
    return this.fillTemplate(template, promptData);
  }

  static identifyTemplate(field, context) {
    // Logic to identify which template to use based on field context
    const fieldText = `${field.label} ${context.nearbyText.join(' ')}`.toLowerCase();
    
    if (fieldText.includes('summary') || fieldText.includes('assessment summary')) {
      return this.templates.summary;
    }
    
    return null;
  }

  static async gatherPromptData(template) {
    const data = {};
    const modal = this.createPromptModal(template.requiredFields);
    
    return new Promise((resolve) => {
      modal.addEventListener('submit', (e) => {
        e.preventDefault();
        template.requiredFields.forEach(field => {
          data[field.key] = modal.querySelector(`[name="${field.key}"]`).value;
        });
        modal.remove();
        resolve(data);
      });
    });
  }

  static createPromptModal(fields) {
    const modal = document.createElement('div');
    modal.className = 'slp-ai-prompt-modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Complete Required Information</h3>
        <form>
          ${fields.map(field => `
            <div class="form-group ${field.type}">
              <label for="${field.key}">${field.label}</label>
              <input type="text" name="${field.key}" id="${field.key}" required>
              ${field.type === 'phi' ? 
                `<div class="phi-warning">⚠️ ${this.disclaimers.phi}</div>` : 
                `<div class="field-note">${this.disclaimers[field.type]}</div>`
              }
            </div>
          `).join('')}
          <div class="modal-actions">
            <button type="submit" class="submit-btn">Generate Response</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
  }

  static async generateGenericResponse(field, context) {
    const prompt = this.buildGenericPrompt(field, context);
    return this.callChatGPT(prompt);
  }

  static async callChatGPT(prompt) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${YOUR_API_KEY}` // You'll need to handle API key securely
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "You are a helpful assistant for speech-language pathologists. Do not generate or include any patient identifiable information. Provide only clinical observations and recommendations based on provided information."
          }, {
            role: "user",
            content: prompt
          }]
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling ChatGPT:', error);
      return 'Error generating response';
    }
  }
} 