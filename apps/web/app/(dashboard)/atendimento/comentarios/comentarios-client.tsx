"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Image as ImageIcon, Send, CheckCircle2, Reply } from "lucide-react";

interface PostItem {
  id: string;
  media_url: string | null;
  caption: string | null;
  timestamp: string | null;
  comment_count: number;
  unanswered_comments: number;
}

interface CommentItem {
  id: string;
  author_name: string;
  author_id: string;
  content: string;
  created_at: string | null;
  replied: boolean;
  reply_content: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Props {
  canReply: boolean;
}

export function ComentariosClient({ canReply }: Props) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const res = await fetch("/api/v1/posts");
      const json = await res.json();
      if (res.ok) {
        setPosts(json.data as PostItem[]);
      } else {
        setPostsError(json.error?.message ?? "Falha ao carregar posts");
      }
    } catch {
      setPostsError("Falha ao carregar posts");
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchComments = useCallback(async (postId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/v1/posts/${postId}/comments`);
      if (res.ok) {
        const json = (await res.json()) as { data: CommentItem[] };
        setComments(json.data);
      } else {
        setComments([]);
      }
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handleSelectPost = useCallback(
    (post: PostItem) => {
      setSelectedPost(post);
      setComments([]);
      void fetchComments(post.id);
    },
    [fetchComments]
  );

  const handleReply = useCallback(
    async (commentId: string, mode: "public" | "direct") => {
      const message = (drafts[commentId] ?? "").trim();
      if (!message) return;
      setSending(commentId);
      try {
        const res = await fetch(`/api/v1/comments/${commentId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, mode }),
        });
        if (res.ok) {
          setDrafts((d) => ({ ...d, [commentId]: "" }));
          if (selectedPost) {
            void fetchComments(selectedPost.id);
            void fetchPosts();
          }
        }
      } finally {
        setSending(null);
      }
    },
    [drafts, selectedPost, fetchComments, fetchPosts]
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Coluna 1: posts recentes */}
      <div className="flex flex-col border-r border-border bg-card" style={{ width: 320, minWidth: 320 }}>
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Comentários</h2>
          <p className="text-xs text-muted-foreground">Posts recentes do Instagram</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingPosts && (
            <p className="p-4 text-xs text-muted-foreground">Carregando posts...</p>
          )}
          {postsError && (
            <p className="p-4 text-xs text-destructive">{postsError}</p>
          )}
          {!loadingPosts && !postsError && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <MessageSquare className="w-6 h-6" />
              <p className="text-xs">Nenhum post encontrado</p>
            </div>
          )}

          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => handleSelectPost(post)}
              className={`w-full text-left px-3 py-3 border-b border-border hover:bg-accent/50 transition-colors ${
                selectedPost?.id === post.id ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {post.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground line-clamp-2">
                    {post.caption ?? "(sem legenda)"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {post.comment_count} comentário{post.comment_count === 1 ? "" : "s"}
                    </span>
                    {post.unanswered_comments > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                        {post.unanswered_comments} sem resposta
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Coluna 2: comentários do post selecionado */}
      <div className="flex flex-col flex-1 min-w-0 bg-background">
        {!selectedPost ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecione um post para ver os comentários
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedPost.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPost.media_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedPost.caption ?? "(sem legenda)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedPost.timestamp)} · {selectedPost.comment_count} comentários
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments && (
                <p className="text-xs text-muted-foreground">Carregando comentários...</p>
              )}
              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum comentário neste post.</p>
              )}

              {comments.map((c) => (
                <div key={c.id} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">@{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{c.content}</p>

                  {c.replied ? (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="font-medium">Respondido:</span> {c.reply_content}
                      </span>
                    </div>
                  ) : canReply ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={drafts[c.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        placeholder="Responder comentário..."
                        className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        disabled={sending === c.id}
                      />
                      <button
                        onClick={() => void handleReply(c.id, "public")}
                        disabled={sending === c.id || !(drafts[c.id] ?? "").trim()}
                        title="Responder no comentário"
                        className="p-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void handleReply(c.id, "direct")}
                        disabled={sending === c.id || !(drafts[c.id] ?? "").trim()}
                        title="Responder no Direct"
                        className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-40"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-foreground">Sem resposta</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
