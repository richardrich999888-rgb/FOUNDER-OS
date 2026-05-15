import { Button } from "@ballast/ui";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <nav className="flex items-center justify-between">
          <span className="text-lg font-semibold">Ballast</span>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </nav>
        <div className="max-w-2xl py-20">
          <h1 className="text-5xl font-semibold tracking-tight">Ballast</h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            Landing page scaffold for founder reflection, privacy, and early access messaging.
          </p>
          <div className="mt-8">
            <Button href="/dashboard">Open dashboard shell</Button>
          </div>
        </div>
      </section>
    </main>
  );
}
