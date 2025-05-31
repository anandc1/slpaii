// AI Service to handle context and responses
class AIService {
  static async analyzeContent(pageStructure) {
    // Analyze the content structure and relationships
    const analysis = {
      mainTopic: this.identifyMainTopic(pageStructure),
      keyPoints: this.extractKeyPoints(pageStructure.sections),
      inputFields: this.filterRelevantInputFields(pageStructure.inputFields)
    };
    
    return analysis;
  }

  static identifyMainTopic(pageStructure) {
    // Identify the main topic from title and first heading
    const title = pageStructure.title;
    const firstSection = pageStructure.sections[0];
    return {
      title: title,
      mainHeading: firstSection?.title || '',
      confidence: this.calculateTopicConfidence(title, firstSection)
    };
  }

  static extractKeyPoints(sections) {
    // Extract key points from sections
    return sections
      .filter(section => section.level <= 3) // Focus on main sections
      .map(section => ({
        title: section.title,
        summary: this.summarizeContent(section.content),
        importance: this.calculateImportance(section)
      }));
  }

  static filterRelevantInputFields(inputFields) {
    const irrelevantPatterns = [
      /menu/i,
      /navigation/i,
      /cookie/i,
      /settings/i,
      /search/i,
      /account/i,
      /login/i,
      /password/i,
      /email/i,
      /subscribe/i
    ];

    return inputFields
      .filter(field => {
        // Filter out non-text inputs
        const type = field.type.toLowerCase();
        if (['checkbox', 'radio', 'submit', 'button'].includes(type)) {
          return false;
        }

        // Filter out fields with irrelevant labels/context
        const fieldText = `${field.label} ${field.context?.formPurpose || ''} ${field.context?.nearbyText?.join(' ') || ''}`.toLowerCase();
        return !irrelevantPatterns.some(pattern => pattern.test(fieldText));
      })
      .map(field => ({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        isTextInput: this.isTextInputField(field.type),
        context: this.getFieldContext(field),
        importance: this.calculateFieldImportance(field)
      }))
      .sort((a, b) => b.importance - a.importance); // Sort by importance
  }

  static calculateFieldImportance(field) {
    // Simple scoring system for field importance
    let score = 0;
    
    // Prefer fields with clear labels
    if (field.label && field.label.length > 0) score += 2;
    
    // Prefer fields with nearby context
    if (field.context?.nearbyText?.length > 0) score += 2;
    
    // Prefer fields in main content areas
    if (field.context?.formPurpose) score += 1;
    
    return score;
  }

  static isTextInputField(type) {
    const textTypes = [
      'text',
      'textarea',
      'contenteditable',
      'textbox',
      'email',
      'search',
      'tel',
      'url'
    ];
    return textTypes.includes(type.toLowerCase());
  }

  static getFieldContext(field) {
    return {
      nearbyText: field.context?.nearbyText || [],
      formPurpose: field.context?.formPurpose || '',
      pageSection: this.findPageSection(field)
    };
  }

  static findPageSection(field) {
    // Implementation to find which section the field belongs to
    return {
      title: field.context?.headers?.[0] || '',
      level: 1
    };
  }

  // Helper methods
  static summarizeContent(content) {
    // Simple content summarization
    const words = content.split(' ');
    return words.length > 30 ? 
      words.slice(0, 30).join(' ') + '...' : 
      content;
  }

  static calculateImportance(section) {
    // Calculate section importance based on heading level and content length
    return {
      level: section.level,
      contentLength: section.content.length,
      score: (6 - section.level) * Math.min(section.content.length / 100, 10)
    };
  }
} 