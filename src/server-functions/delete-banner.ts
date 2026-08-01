import { createServerFn } from "@tanstack/react-start";
import { doc, deleteDoc } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const deleteBanner = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; bannerId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.bannerId) throw new Error("ID bannière manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    await deleteDoc(doc(serverDb, "banners", data.bannerId));
    return { success: true };
  });
