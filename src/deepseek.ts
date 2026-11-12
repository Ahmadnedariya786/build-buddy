/**
 * Backward compatibility re-export
 * DeepSeek engine has been upgraded to Google Gemini API (gemini-2.5-flash).
 */
export {
  analyzeProjectWithGemini as analyzeProjectWithDeepSeek,
  analyzeProjectWithGemini,
  runMockDiagnosis
} from './gemini';
