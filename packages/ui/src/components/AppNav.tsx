import Link from "next/link";

export function AppNav() {
  return (
    <div className="border-b divider">
      <div className="max-w-6xl mx-auto px-8 h-14 flex items-center gap-4">
        <Link href="/home" className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#5B21B6)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M12 3v18M3 12h18" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight">AutoBusiness</span>
        </Link>
        <div className="ml-auto flex items-center gap-6 text-sm text-dim">
          <Link href="/home" className="hover:text-white transition-colors">
            Projects
          </Link>
          <Link href="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
          <a
            href="https://github.com/anthropics/claude-code"
            className="hover:text-white transition-colors"
          >
            Docs
          </a>
          <div
            className="h-7 w-7 rounded-full surface-2 flex items-center justify-center text-xs mono"
            style={{ border: "1px solid var(--border)" }}
          >
            SP
          </div>
        </div>
      </div>
    </div>
  );
}
