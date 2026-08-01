import { getAuth } from "firebase/auth";
import { doc, increment } from "firebase/firestore";
import type { Firestore, Transaction } from "firebase/firestore";
import { ensureServerReady } from "./firebase";

// Le vault est le profil du robot de service. Les frais d'inscription y sont
// déposés en escrow et redistribués au settlement (prix + organisateur) ou
// remboursés à l'annulation. Aucun organisateur ne peut encaisser avant la
// fin réelle du tournoi.
export async function getVaultUid(): Promise<string> {
  await ensureServerReady();
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Vault indisponible (robot non authentifié)");
  return uid;
}

export function vaultProfileRef(db: Firestore, vaultUid: string) {
  return doc(db, "profiles", vaultUid);
}

// Crédite le vault (crée le profil robot si absent — merge + increment).
export function creditVault(
  transaction: Transaction,
  db: Firestore,
  vaultUid: string,
  amount: number,
) {
  transaction.set(
    vaultProfileRef(db, vaultUid),
    { pxp: increment(amount), is_robot: true },
    { merge: true },
  );
}
