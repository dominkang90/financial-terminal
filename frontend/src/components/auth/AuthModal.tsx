import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
}

export function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { login, register, isLoading } = useAuthStore();

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
            className="w-full py-2 bg-terminal-accent hover:bg-terminal-accent-dim text-black text-xs font-semibold font-mono rounded transition-colors disabled:opacity-50"
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
