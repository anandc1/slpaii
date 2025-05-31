import { db } from './firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  fields: any;
  schema: any;
}

export async function getTemplates(): Promise<AssessmentTemplate[]> {
  try {
    const templatesRef = collection(db, 'template_assessments');
    const templatesSnap = await getDocs(templatesRef);
    
    const templates: AssessmentTemplate[] = [];
    templatesSnap.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() } as AssessmentTemplate);
    });
    
    return templates;
  } catch (error) {
    console.error('Error getting templates:', error);
    return [];
  }
}

export async function getTemplate(templateId: string): Promise<AssessmentTemplate | null> {
  try {
    const templateRef = doc(db, 'template_assessments', templateId);
    const templateSnap = await getDoc(templateRef);
    
    if (templateSnap.exists()) {
      return { id: templateSnap.id, ...templateSnap.data() } as AssessmentTemplate;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
}
