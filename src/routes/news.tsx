import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { PageHeader } from "@/components/page-header";
import { useNews } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, Eye, Newspaper, Plus, X, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/lib/firebase-auth-context";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createNewsArticle } from "@/server-functions/create-news";
import { useAdminStatus } from "@/lib/queries";
import type { NewsArticle } from "@/lib/queries";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Actualités Free Fire — FireArena" },
      { name: "description", content: "Toute l'actualité de la scène e-sport Free Fire." },
    ],
  }),
  component: NewsPage,
});

const CATEGORIES = [
  { value: "all", label: "Tout", icon: Newspaper },
  { value: "tournoi", label: "Tournois", icon: Newspaper },
  { value: "patch", label: "Patchs", icon: Newspaper },
  { value: "guide", label: "Guides", icon: Newspaper },
  { value: "interview", label: "Interviews", icon: Newspaper },
  { value: "esport", label: "E-Sport", icon: Newspaper },
];

const CATEGORY_VALUES = CATEGORIES.filter((c) => c.value !== "all").map((c) => c.value);

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}

function NewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(CATEGORY_VALUES),
  );
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    cover_url: "",
    category: "tournoi",
    read_time: 3,
    is_featured: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: firebaseArticles, isLoading } = useNews();

  const { data: isAdmin } = useAdminStatus();

  const articles = (firebaseArticles ?? []) as NewsArticle[];

  const isAllSelected = selectedCategories.size === CATEGORY_VALUES.length;

  const filtered = articles.filter((a) => {
    if (!isAllSelected && a.category && !selectedCategories.has(a.category)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.title?.toLowerCase().includes(q) || a.excerpt?.toLowerCase().includes(q);
    }
    return true;
  });

  const featured = filtered.find((a) => a.is_featured) ?? filtered[0];
  const rest = filtered.filter((a) => a.id !== featured?.id);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      await createNewsArticle({ data: { idToken, ...form } });
      toast.success("Article publié !");
      setShowForm(false);
      setForm({
        title: "",
        excerpt: "",
        content: "",
        cover_url: "",
        category: "tournoi",
        read_time: 3,
        is_featured: false,
      });
      queryClient.invalidateQueries({ queryKey: ["news"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Actualités"
          title="Actualités"
          subtitle="Toute la scène e-sport Free Fire, en un seul endroit."
          action={
            isAdmin && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#fc0] to-[#ffd740] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(255,204,0,0.5)] hover:opacity-90"
              >
                {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showForm ? "Fermer" : "Ajouter un article"}
              </button>
            )
          }
        />

        {isAdmin && showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-2xl border border-border/40 bg-card/60 p-6 space-y-4"
          >
            <h2 className="text-lg font-bold">Nouvel article</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Titre</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Extrait</label>
                <Input
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Contenu (Markdown)</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full min-h-[120px] rounded-xl border border-border/40 bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL de couverture</label>
                <Input
                  value={form.cover_url}
                  onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-sm"
                >
                  {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Temps de lecture (min)</label>
                <Input
                  type="number"
                  min={1}
                  value={form.read_time}
                  onChange={(e) => setForm({ ...form, read_time: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="featured"
                  checked={form.is_featured}
                  onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                />
                <label htmlFor="featured" className="text-sm font-medium">
                  À la une
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-sunset px-6 py-2 text-sm font-semibold text-white shadow-glow-sm hover:bg-sunset/90 disabled:opacity-50"
            >
              {submitting ? "Publication..." : "Publier l'article"}
            </button>
          </form>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setCategoriesOpen((o) => !o)}
              className="flex items-center gap-1.5 self-start rounded-full bg-card/60 border border-border/40 px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all sm:hidden"
            >
              Catégories
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div className={`flex flex-wrap gap-2 ${categoriesOpen ? "flex" : "hidden sm:flex"}`}>
              <button
                onClick={() => setSelectedCategories(new Set(CATEGORY_VALUES))}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isAllSelected
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40"
                }`}
              >
                <Newspaper className="h-3.5 w-3.5" />
                Tout
              </button>
              {CATEGORIES.filter((c) => c.value !== "all").map(({ value, label, icon: Icon }) => {
                const isActive = selectedCategories.has(value);
                return (
                  <button
                    key={value}
                    onClick={() =>
                      setSelectedCategories((prev) => {
                        const next = new Set(prev);
                        if (next.has(value)) {
                          next.delete(value);
                        } else {
                          next.add(value);
                        }
                        return next;
                      })
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/60 border-border/40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-16 text-center">
            <Newspaper className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucun article pour le moment.</p>
            {isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sunset px-4 py-2 text-sm font-semibold text-white shadow-glow-sm hover:bg-sunset/90"
              >
                <Plus className="h-4 w-4" /> Ajouter le premier article
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {featured && (
              <article className="group relative rounded-2xl overflow-hidden cursor-pointer h-80 md:h-96">
                <img
                  src={featured.cover_url}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-2xl font-black text-white leading-tight">{featured.title}</h2>
                  <p className="mt-1 text-sm text-white/70 line-clamp-2">{featured.excerpt}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {featured.read_time} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {(featured.views ?? 0).toLocaleString("fr-FR")}{" "}
                      vues
                    </span>
                    <span>{timeAgo(featured.published_at)}</span>
                  </div>
                </div>
              </article>
            )}

            {rest.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Derniers articles</h2>
                  <Badge variant="secondary">{rest.length}</Badge>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {rest.map((article) => (
                    <article
                      key={article.id}
                      className="group rounded-2xl border border-border/40 bg-card/40 overflow-hidden hover:border-primary/40 hover:bg-card/70 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                    >
                      <div className="relative overflow-hidden h-48">
                        <img
                          src={article.cover_url}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {article.excerpt}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.read_time} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {(article.views ?? 0).toLocaleString("fr-FR")}
                            </span>
                          </div>
                          <span>{timeAgo(article.published_at)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
