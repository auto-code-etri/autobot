/**
 * Utility to check if a user is an Autobot team member
 */
export function isContinueTeamMember(email?: string): boolean {
  if (!email) return false;
  return email.endsWith("@etri.re.kr");
}
