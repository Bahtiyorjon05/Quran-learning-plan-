import { setRequestLocale } from "next-intl/server";

import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/landing/hero";
import { HadithBand } from "@/components/landing/hadith-band";
import { Problem } from "@/components/landing/problem";
import { CovenantDemo } from "@/components/landing/covenant-demo";
import { Tracks } from "@/components/landing/tracks";
import { MosaicSection } from "@/components/landing/mosaic-section";
import { Practice } from "@/components/landing/practice";
import { Everything } from "@/components/landing/everything";
import { FinalCta } from "@/components/landing/final-cta";
import { InstallApp } from "@/components/site/install-app";
import { Measure } from "@/components/ui/section";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <HadithBand />
        <Problem />
        <CovenantDemo />
        <Tracks />
        <MosaicSection />
        <Practice />
        <Everything />

        {/* Between what Ahd does and the invitation to start — the moment
            someone has decided they want it. Draws nothing where installing is
            not possible, so it never becomes an empty box. */}
        <Measure className="pb-4">
          <div className="mx-auto max-w-2xl">
            <InstallApp variant="banner" />
          </div>
        </Measure>

        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
