import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";
import { serverDb } from "@/server-functions/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const createNewsArticle = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      title: string;
      excerpt: string;
      content: string;
      cover_url: string;
      category: string;
      read_time: number;
      is_featured: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const docRef = await addDoc(collection(serverDb, "news"), {
      title: data.title,
      slug: data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      excerpt: data.excerpt,
      content: data.content,
      cover_url: data.cover_url,
      category: data.category,
      author_name: "FireArena",
      read_time: data.read_time,
      is_featured: data.is_featured,
      views: 0,
      published_at: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  });
