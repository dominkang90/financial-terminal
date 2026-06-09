import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
}

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:8000";

function openOAuthPopup(provider: "google" | "kakao", onToken: (token: string) => void) {
  const url = `${BACKEND}/api/auth/oauth/${provider}/start`;
  const popup = window.open(url, `${provider}_oauth`, "width=520,height=620,left=400,top=100");
  if (!popup) {
    toast.error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.");
    return;
  }
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "oauth_success") {
      window.removeEventListener("message", handler);
      onToken(e.data.token);
    } else if (e.data?.type === "oauth_error") {
      window.removeEventListener("message", handler);
      toast.error("소셜 로그인에 실패했습니다");
    }
  };
  window.addEventListener("message", handler);
}

export function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { login, register, isLoading, fetchMe } = useAuthStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("로그인 성공!");
      } else {
        await register(email, username, password);
        toast.success("가입 완료!");
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "오류가 발생했습니다";
      toast.error(msg);
    }
  };

  const handleOAuth = (provider: "google" | "kakao") => {
    openOAuthPopup(provider, async (token) => {
      localStorage.setItem("access_token", token);
      await fetchMe();
      toast.success("소셜 로그인 성공!");
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-terminal-panel border border-terminal-border rounded-lg w-full max-w-sm mx-4 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-terminal-text-primary font-mono">
            {mode === "login" ? "로그인" : "회원가입"}
          </h2>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text-primary">
            <X size={14} />
          </button>
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            className="w-full flex items-center justify-center gap-2 py-2 border border-terminal-border rounded text-xs font-mono text-terminal-text-secondary hover:border-terminal-accent hover:text-terminal-text-primary transition-colors"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("kakao")}
            className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-mono font-semibold transition-colors"
            style={{ background: "#FEE500", color: "#191919" }}
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-terminal-border" />
          <span className="text-2xs text-terminal-text-dim font-mono">이메일로 계속</span>
          <div className="flex-1 h-px bg-terminal-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <Field label="사용자명" value={username} onChange={setUsername} placeholder="username" />
          )}
          <Field label="이메일" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <div className="space-y-1">
            <label className="text-2xs text-terminal-text-dim font-mono uppercase">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 8자"
                required
                className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-terminal-text-dim"
              >
                {showPw ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-terminal-accent hover:bg-terminal-accent-dim text-white text-xs font-semibold font-mono rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-2xs text-terminal-text-dim hover:text-terminal-accent font-mono"
          >
            {mode === "login" ? "계정이 없으신가요? 가입하기" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#191919">
      <path d="M12 3C6.48 3 2 6.69 2 11.25c0 2.9 1.85 5.46 4.64 6.97l-1.18 4.38 5.1-3.38c.47.06.95.1 1.44.1 5.52 0 10-3.69 10-8.25S17.52 3 12 3z"/>
    </svg>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-2xs text-terminal-text-dim font-mono uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent"
      />
    </div>
  );
}
