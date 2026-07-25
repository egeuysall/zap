export default function CliAuthSuccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0f0f0f] p-6 text-white">
      <div className="w-full max-w-sm space-y-2 rounded-xl bg-[#212121] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#aaa]">Zap CLI</p>
        <h1 className="text-xl font-semibold">Terminal signed in</h1>
        <p className="text-sm leading-6 text-[#aaa]">You can close this tab and return to your terminal.</p>
      </div>
    </main>
  );
}
