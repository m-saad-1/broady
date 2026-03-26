export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-10">
      <section className="w-full space-y-4 border border-zinc-300 p-8">
        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Offline Mode</p>
        <h1 className="font-heading text-5xl uppercase">You are offline</h1>
        <p className="text-sm leading-7 text-zinc-700">
          BROADY is installed as a progressive web app. Reconnect to continue checkout and refresh catalog updates.
        </p>
      </section>
    </main>
  );
}
