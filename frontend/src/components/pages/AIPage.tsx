import { AIAssistant } from "@/components/widgets/AIAssistant";
import { QuotePanel } from "@/components/widgets/QuotePanel";

export function AIPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <div className="hidden md:block w-44 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
