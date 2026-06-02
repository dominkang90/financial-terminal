import { Portfolio } from "@/components/widgets/Portfolio";
import { NewsFeed } from "@/components/widgets/NewsFeed";

export function PortfolioPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <Portfolio />
      </div>
      <div className="w-80 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <NewsFeed />
      </div>
    </div>
  );
}
