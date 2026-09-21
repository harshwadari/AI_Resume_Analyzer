export const JD_MIN_LENGTH = 100;
export const JD_MAX_LENGTH = 20000;

export function jdTextError(text) {
  if (text.length > JD_MAX_LENGTH) return 'Job description must be at most 20,000 characters.';
  if (text.trim().length < JD_MIN_LENGTH) return 'Add at least 100 characters of job description content.';
  return '';
}
