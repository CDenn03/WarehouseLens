import { LandingHeader } from "@/features/landing/components/LandingHeader";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { ModulesSection } from "@/features/landing/components/ModulesSection";
import { StackSection } from "@/features/landing/components/StackSection";
import { WhoSection } from "@/features/landing/components/WhoSection";
import { FaqSection } from "@/features/landing/components/FaqSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection />
        <ModulesSection />
        <StackSection />
        <WhoSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </>
  );
}
