import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./HeroSection";
import { ModulesSection } from "./ModulesSection";
import { WhoSection } from "./WhoSection";
import { StackSection } from "./StackSection";
import { FaqSection } from "./FaqSection";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main id="top">
        <HeroSection />
        <ModulesSection />
        <WhoSection />
        <StackSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </>
  );
}
