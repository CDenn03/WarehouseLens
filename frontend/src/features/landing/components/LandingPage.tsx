import { LandingHeader } from "./LandingHeader";
import LandingHero from "./LandingHero";
import LandingModules from "./LandingModules";
import { StatsSection } from "./StatsSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { WhoSection } from "./WhoSection";
import { CopilotSection } from "./CopilotSection";
import { FaqSection } from "./FaqSection";
import { CtaSection } from "./CtaSection";
import { LandingFooter } from "./LandingFooter";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <LandingHeader />
      <LandingHero />
      <LandingModules />
      <StatsSection />
      <HowItWorksSection />
      <WhoSection />
      <CopilotSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </>
  );
}
