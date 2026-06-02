import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { marketApi } from "@/api/client";
import { useMarketStore } from "@/store/marketStore";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export function CommandBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setActiveSymbol, addToWatchlist } = useMarketStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await marketApi.search(v.trim());
        setResults(r.slice(0, 10));
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const selectSymbol = (symbol: string) => {
    setActiveSymbol(symbol);
    addToWatchlist(symbol);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex-1 max-w-sm">
      <div className="flex items-center gap-1.5 bg-terminal-panel border border-terminal-border rounded px-2 py-1">
        <Search size={12} className="text-terminal-text-dim flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="종목/ETF 검색 (Ctrl+K)"
          className="bg-transparent text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none w-full"
        />
        {isLoading && (
          <div className="w-2 h-2 border border-terminal-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {query && !isLoading && (
          <button onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}>
            <X size={10} className="text-terminal-text-dim hover:text-terminal-text-primary" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-terminal-panel border border-terminal-border rounded shadow-xl z-50 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => selectSymbol(r.symbol)}
              className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-terminal-border text-left"
            >
              <span className="font-mono text-xs text-terminal-accent font-semibold w-16 flex-shrink-0">{r.symbol}</span>
              <span className="text-2xs text-terminal-text-secondary truncate flex-1">{r.name}</span>
              <span className="text-2xs text-terminal-text-dim flex-shrink-0">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
