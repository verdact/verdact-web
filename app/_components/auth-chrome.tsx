import type { ReactNode } from 'react';
import { VerdactLogo } from './verdact-logo';

type AuthFrameProps = {
  children: ReactNode;
};

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="flex min-h-[100dvh] bg-paper text-ink">
      {/* LEFT: Form / Interactive Area */}
      <div className="flex w-full flex-col lg:w-1/2 xl:w-[45%] border-r border-rule relative z-10 bg-paper">
        <AuthHeader />
        
        <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
          <div className="w-full max-w-[440px] mx-auto lg:mx-0">
            {children}
          </div>
        </div>

        <AuthFooter />
      </div>

      {/* RIGHT: Visual / Premium Brand Area */}
      <div className="hidden lg:block lg:flex-1 relative bg-surface-2 overflow-hidden">
        {/* We use the generated trustworthy abstract texture */}
        <img 
          src="/auth-bg.png" 
          alt="Abstract mint and warm paper texture" 
          className="absolute inset-0 w-full h-full object-cover select-none"
        />
        
        {/* Subtle gradient overlay to ensure text contrast if we add a quote, and to soften the image */}
        <div className="absolute inset-0 bg-gradient-to-t from-verdict-deep/40 via-transparent to-transparent mix-blend-multiply" />
        
        <div className="absolute inset-0 flex flex-col justify-end p-16 pb-24 text-paper">
           <div className="max-w-lg space-y-5">
             <div className="h-1 w-12 bg-mint rounded-full mb-6" />
             <h2 className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">
               Evidence that wins.
             </h2>
             <p className="text-lg text-white/90 leading-relaxed max-w-md drop-shadow-sm">
               Connect Stripe, organize your policies, and submit compelling dispute responses with absolute confidence.
             </p>
           </div>
        </div>
      </div>
    </main>
  );
}

function AuthHeader() {
  return (
    <header className="w-full">
      <div className="flex items-center justify-between gap-4 px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
        <a
          href="/"
          className="flex w-fit items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict"
        >
          <VerdactLogo variant="lockup" priority className="h-8 w-auto text-verdict-deep" />
        </a>

        <a
          href="/"
          className="text-sm font-medium text-ink-mute transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm px-1 py-0.5"
        >
          ← Back to site
        </a>
      </div>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-12 lg:px-16 xl:px-24 text-sm text-ink-mute">
        <p className="meta-mono">© {new Date().getFullYear()} Verdact</p>
        
        <div className="flex items-center gap-4 font-medium">
          <a
            className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm"
            href="/privacy"
          >
            Privacy
          </a>
          <a
            className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm"
            href="/terms"
          >
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
