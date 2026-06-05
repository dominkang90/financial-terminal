import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { RefreshCw, Play, ExternalLink, X, Tags } from "lucide-react";
import { newsApi } from "@/api/client";
import type { NewsArticle, VideoNewsResponse } from "@/types";

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

function VideoInsightModal({ article, open, onOpenChange }: { article: NewsArticle | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!article) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#2a2a2a] bg-[#101010] shadow-2xl outline-none max-h-[88vh] overflow-y-auto">
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-[#222] bg-[#101010]">
            <Dialog.Title className="text-sm font-semibold text-[#f2f2f2]">영상 인사이트</Dialog.Title>
            <Dialog.Close className="text-[#777] hover:text-white">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="p-4 space-y-4">
            {article.video_thumbnail && (
              <a href={article.video_url || article.url} target="_blank" rel="noopener noreferrer" className="block relative rounded-lg overflow-hidden border border-[#222]">
                <img src={article.video_thumbnail} alt={article.title} className="w-full h-64 object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#ff6600]/90 flex items-center justify-center shadow-lg">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              </a>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-2xs font-mono text-[#777]">
                <span>{article.source}</span>
                <span>·</span>
                <span>{formatTime(article.published_at)}</span>
                {article.topic_label && (
                  <span className="px-2 py-0.5 rounded-full bg-[#ff6600]/10 border border-[#ff6600]/20 text-[#ff8833]">
                    {article.topic_label}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-[#f4f4f4] leading-snug">{article.title_ko || article.title}</h3>
              {article.summary && (
                <p className="text-sm text-[#c8c8c8] leading-relaxed whitespace-pre-wrap">{article.summary_ko || article.summary}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#232323] bg-[#151515] p-4 space-y-2">
              <div className="text-xs font-semibold text-[#ff8833]">종합 정리</div>
              <p className="text-sm text-[#e8e8e8] leading-relaxed">{article.insight || "분석 요약을 준비 중입니다."}</p>
            </div>

            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-2xs font-mono text-[#8ec5ff]">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <a
                href={article.video_url || article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#ff6600] px-3 py-2 text-xs font-semibold text-black hover:bg-[#ff7a1a]"
              >
                <Play size={13} />
                유튜브에서 보기
              </a>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#2d2d2d] px-3 py-2 text-xs text-[#ddd] hover:border-[#444] hover:text-white"
              >
                <ExternalLink size={13} />
                링크 열기
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function VideoCard({ article, onOpenInsight }: { article: NewsArticle; onOpenInsight: (article: NewsArticle) => void }) {
  return (
    <div className="group rounded-xl overflow-hidden border border-[#202020] bg-[#111] hover:border-[#323232] transition-colors flex flex-col">
      <button onClick={() => onOpenInsight(article)} className="relative text-left">
        <img
          src={article.video_thumbnail || article.image || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
          alt={article.title}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-2xs font-mono text-white">
          <Play size={8} fill="white" />
          VIDEO
        </div>
      </button>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-2xs font-mono text-[#777]">
          <span className="truncate">{article.source}</span>
          <span>{formatTime(article.published_at)}</span>
        </div>

        <button onClick={() => onOpenInsight(article)} className="text-left">
          <h3 className="text-sm font-medium text-[#ececec] leading-snug line-clamp-2 hover:text-[#ff8833] transition-colors">
            {article.title_ko || article.title}
          </h3>
        </button>

        {article.insight && (
          <p className="text-2xs text-[#999] leading-relaxed line-clamp-3">{article.insight}</p>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(article.tags || []).slice(0, 4).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-[#1a1a1a] text-2xs font-mono text-[#7cb8ff] border border-[#262626]">
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onOpenInsight(article)}
              className="inline-flex items-center gap-1 rounded-md border border-[#2b2b2b] px-2 py-1 text-2xs font-mono text-[#ddd] hover:border-[#444] hover:text-white"
            >
              <Tags size={10} />
              인사이트
            </button>
            <a
              href={article.video_url || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-2xs font-mono text-[#ff8833] hover:text-[#ffb36b]"
            >
              <Play size={10} />
              영상 열기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoNewsFeed() {
  const [payload, setPayload] = useState<VideoNewsResponse | null>(null);
  const [topic, setTopic] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  const load = useCallback(async (topicValue: string) => {
    setIsLoading(true);
    try {
      const data = await newsApi.videos(topicValue, 24);
      setPayload(data);
    } catch {
      setPayload({ videos: [], topics: [{ id: "all", label: "전체" }], overall_insight: "유튜브 영상을 불러오지 못했습니다.", updated_at: new Date().toISOString() });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(topic);
    const id = setInterval(() => load(topic), 300_000);
    return () => clearInterval(id);
  }, [load, topic]);

  const topics = useMemo(() => payload?.topics || [{ id: "all", label: "전체" }], [payload]);
  const videos = payload?.videos || [];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] flex-shrink-0">
        <span className="text-xs font-mono text-[#ddd]">유튜브 뉴스</span>
        <span className="text-2xs font-mono text-[#555] hidden md:block">· 실시간 최신 영상 + 태그 + 팝업 인사이트</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 overflow-x-auto">
          {topics.map((item) => (
            <button
              key={item.id}
              onClick={() => setTopic(item.id)}
              className={`px-2 py-0.5 rounded-full text-2xs font-mono whitespace-nowrap ${
                topic === item.id ? "bg-[#ff6600] text-black font-semibold" : "text-[#666] hover:text-[#bbb]"
              }`}
            >
              #{item.label}
            </button>
          ))}
        </div>
        <button onClick={() => load(topic)} disabled={isLoading} className="text-[#444] hover:text-[#ddd] disabled:opacity-40">
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="rounded-xl border border-[#242424] bg-[#111] p-4 space-y-2">
          <div className="text-xs font-semibold text-[#ff8833]">종합 인사이트</div>
          <p className="text-sm text-[#e6e6e6] leading-relaxed">{payload?.overall_insight || "유튜브 영상을 불러오는 중입니다."}</p>
          <div className="text-2xs font-mono text-[#666]">업데이트: {payload ? formatTime(payload.updated_at) : "방금"}</div>
        </div>

        {isLoading && videos.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-center space-y-2">
              <RefreshCw size={20} className="animate-spin text-[#ff6600] mx-auto" />
              <div className="text-xs text-[#666] font-mono">유튜브 영상과 인사이트를 정리하는 중...</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {videos.map((article) => (
              <VideoCard key={article.id} article={article} onOpenInsight={setSelected} />
            ))}
          </div>
        )}

        {!isLoading && videos.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs font-mono text-[#555]">
            현재 조건에 맞는 영상이 없습니다.
          </div>
        )}
      </div>

      <VideoInsightModal article={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
