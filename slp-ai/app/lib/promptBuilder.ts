const prompts = {
  summary: {
    questions: [
      'What are the key developmental milestones observed?',
      'How does the child compare to typical development?',
      'What are the main areas of progress noted?',
      'What patterns of behavior are consistently observed?'
    ],
    template: `[Child's name] is a [age] old [gender] who was referred for an evaluation due to concerns with [his/her] communication abilities and suspected ASD. Based on the result of the REEL-4 language assessment, parent report, and clinical judgment, [Child's name] presented with a mixed receptive/expressive language disorder. [Child's name] communicates primarily through [communication methods]. Social-pragmatics skills were judged to be [assessment] as observed by [observations]. Given these results, it is recommended that [Child's name] receive skilled speech-language therapy [frequency] for [duration] sessions to maximize [his/her] ability to functionally communicate [his/her] wants, needs, and ideas.`
  },
  strengths: {
    questions: [
      'What skills has the child mastered?',
      'In which areas does the child excel?',
      'What positive behaviors are consistently demonstrated?',
      'What activities does the child engage in successfully?'
    ],
    template: ''
  },
  areasOfEmergence: {
    questions: [
      'What skills are beginning to develop?',
      'Which abilities show promise of improvement?',
      'What new behaviors are starting to appear?',
      'What developmental changes are becoming evident?'
    ],
    template: ''
  },
  weaknesses: {
    questions: [
      'What areas need additional support?',
      'Which skills are below age expectations?',
      'What specific challenges does the child face?',
      'What interventions might be beneficial?'
    ],
    template: ''
  },
  hearing: {
    questions: [
      'What are the results of recent hearing assessments?',
      'Are there any concerns about auditory processing?',
      'How does hearing impact daily communication?',
      'What accommodations are currently in place?'
    ],
    template: `A formal hearing screening was not administered during this evaluation. Baseline hearing levels are unknown, however, [Child's name]'s [parent/guardian] denies concerns with [his/her] hearing abilities demonstrated by [observations].`
  }
};

export function buildPrompt(ageRange: string, section: keyof typeof prompts): string {
  const { questions, template } = prompts[section];
  
  return `As a speech-language pathologist, please generate a detailed report section about a ${ageRange} year old child's ${section}.

Consider these assessment points:
${questions.map(q => `- ${q}`).join('\n')}

Reference template:
${template}

Based on these observations and the template structure, generate a professional, detailed paragraph that addresses the above points:`;
} 