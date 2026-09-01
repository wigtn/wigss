import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const VALUES = [
  {
    title: 'Strategy first',
    body: 'Every engagement starts with the problem, not the deliverable. We write the brief before we open a design tool.',
  },
  {
    title: 'Pixel-perfect delivery',
    body: 'Handoff is not a PDF. We ship coded components that match the mock to the pixel at every breakpoint.',
  },
  {
    title: 'Small team, senior hands',
    body: 'No account managers between you and the people doing the work. You talk to the designer who designs.',
  },
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-8 py-16 max-w-7xl mx-auto w-full">
        <section data-component="header" className="mb-16 max-w-2xl">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4">
            About Us
          </span>
          <h1 className="text-4xl font-bold mb-4">
            A design studio that <span className="text-violet-400">ships</span>
          </h1>
          <p className="text-gray-400 leading-relaxed">
            PixelCraft is a five-person studio in Seoul. Since 2021 we have
            helped startups and enterprises turn rough ideas into interfaces
            people actually use.
          </p>
        </section>

        <section data-component="grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {VALUES.map((v) => (
            <article
              key={v.title}
              data-component="card"
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors"
            >
              <h3 className="text-lg font-semibold mb-2">{v.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{v.body}</p>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
