import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 py-32 px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Esprit Portal V2
          </h1>
          <p className="max-w-md text-lg leading-8 text-foreground/60">
            A unified, anti-fragile student portal that bypasses geo-blocking
            using your own devices as secure proxies.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-primary-foreground transition-colors hover:bg-primary/90 md:w-auto"
            href="/login"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
