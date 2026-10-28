import { signIn } from "../auth/session";

export async function handleLogin(body: { email?: string; password?: string }) {
  if (!body.email || !body.password) {
    return { status: 400, error: "Email and password are required" };
  }
  const token = await signIn(body.email, body.password);
  return token ? { status: 200, token } : { status: 401, error: "Invalid credentials" };
}
