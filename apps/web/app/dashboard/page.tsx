import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold">Dashboard Shell</h1>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>
        <SignedOut>
          <div className="py-10">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-ballast-tide px-4 py-2 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>
        <SignedIn>
          <section className="grid gap-4 py-8 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              Reflections scaffold
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">Memory scaffold</div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">Exports scaffold</div>
          </section>
        </SignedIn>
      </div>
    </main>
  );
}
