import { createServerFn } from "@tanstack/react-start";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const createBanner = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      image_url: string;
      title: string;
      subtitle?: string;
      cta?: string;
      link?: string;
      order: number;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.image_url) throw new Error("Image manquante");
      if (!input.title?.trim()) throw new Error("Titre manquant");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const bannerRef = doc(collection(serverDb, "banners"));
    await setDoc(bannerRef, {
      image_url: data.image_url,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() ?? "",
      cta: data.cta?.trim() ?? "",
      link: data.link?.trim() ?? "/tournaments",
      order: data.order,
      active: true,
      created_at: serverTimestamp(),
    });

    return { success: true, id: bannerRef.id };
  });
