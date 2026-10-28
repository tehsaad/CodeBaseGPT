export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

const users = new Map<string, User>();

export async function findUserByEmail(email: string): Promise<User | null> {
  return users.get(email.toLowerCase()) ?? null;
}
