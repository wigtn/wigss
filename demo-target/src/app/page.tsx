import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import CardGrid from '@/components/CardGrid';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-8 py-10 max-w-7xl mx-auto w-full">
        <Hero />

        <div className="flex gap-8">
          <CardGrid />
          <Sidebar />
        </div>
      </main>

      <Footer />
    </div>
  );
}
