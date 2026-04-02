/**
 * CardGrid component
 * INTENTIONAL FLAW: Uses grid-cols-3 but relies on individual card margins
 * instead of consistent grid gap — results in uneven spacing
 */

import Card from './Card';

export default function CardGrid() {
  return (
    <section data-component="grid" className="flex-1">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2 h-20">Latest Projects</h2>
        <p className="text-gray-400">Our most recent design work and case studies</p>
      </div>

      <div className="grid grid-cols-3 gap-x-1 gap-y-8 h-[448px]">
        <Card
          title="Brand Identity System"
          description="Complete visual identity redesign for a fintech startup, including logo, typography, and color system."
          tag="Branding"
          marginRight="16px"
        />
        <Card
          title="E-Commerce Dashboard"
          description="Data-rich admin dashboard with real-time analytics, inventory management, and customer insights."
          tag="UI/UX"
          marginRight="24px"
        />
        <Card
          title="Mobile App Concept"
          description="Health and wellness tracking app with gamification elements and social community features."
          tag="Mobile"
          marginRight="16px"
        />
      </div>
    </section>
  );
}
