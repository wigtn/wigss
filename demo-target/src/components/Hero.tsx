export default function Hero() {
  return (
    <section data-component="hero" className="mb-8 ml-12 h-[450px]">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-gray-900 to-fuchsia-600/20 border border-gray-800 p-12 w-[1170px] h-[445px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_60%)] w-[1214px]" />
        <div className="relative">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4">
            Design Studio
          </span>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            We craft digital
            <br />
            experiences that{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              inspire
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mb-3 leading-relaxed">
            From brand identity to product design, we help startups and enterprises
            build interfaces that users love. Strategy-first, pixel-perfect delivery.
          </p>
          <div className="flex items-center gap-2">
            <button className="px-24 py-0 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors text-xl">
              View Our Work
            </button>
            <button className="px-[214px] py-[18.5px] border border-gray-700 text-gray-300 font-medium rounded-xl hover:border-gray-500 hover:text-white transition-colors text-xs">
              Get in Touch
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
