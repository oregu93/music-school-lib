import { getChatGPTUser } from './chatgpt-auth';

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user;
}
