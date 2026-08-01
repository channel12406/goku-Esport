import { createServerFn } from "@tanstack/react-start";
import { ensureServerReady } from "./firebase";

const FIREBASE_API_KEY =
  import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDJCHm6KetdTztLULSXoXomXDDPRfrurYg";

export async function verifyIdToken(idToken: string): Promise<{ uid: string; email?: string }> {
  // Le serveur doit être authentifié (robot) avant d'écrire via le SDK Firestore.
  await ensureServerReady();

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
  const user = data.users?.[0];
  if (!user) throw new Error("Token invalide");
  return { uid: user.localId, email: user.email || undefined };
}

export const verifyToken = createServerFn({ method: "POST" })
  .validator((input: { idToken: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    return verifyIdToken(data.idToken);
  });
