import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export async function assertNotBanned(db: Firestore, uid: string): Promise<void> {
  const profileSnap = await getDoc(doc(db, "profiles", uid));
  if (!profileSnap.exists()) throw new Error("Profil introuvable");
  if (profileSnap.data().is_banned === true) {
    throw new Error("Votre compte est banni. Contactez l'administrateur.");
  }
}
