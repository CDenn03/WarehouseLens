import LandingNav from "./LandingNav";
import LandingHero from "./LandingHero";
import LandingModules from "./LandingModules";
import { StatsSection } from "./StatsSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { WhoSection } from "./WhoSection";
import { CopilotSection } from "./CopilotSection";
import { StackSection } from "./StackSection";
import { FaqSection } from "./FaqSection";
import { CtaSection } from "./CtaSection";
import { LandingFooter } from "./LandingFooter";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      {/* ── Original hero — untouched ── */}
      <LandingNav />
      <LandingHero />
      <LandingModules />

      {/* ── New sections ── */}
      <StatsSection />
      <HowItWorksSection />
      <WhoSection />
      <CopilotSection />
      <StackSection />
      <FaqSection />
      <CtaSection />
      <LandingFooter />
    </>
  );
}
