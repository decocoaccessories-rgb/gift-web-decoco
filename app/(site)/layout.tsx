import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ExitIntentOfferGate from "@/components/marketing/ExitIntentOfferGate";
import AttributionTracker from "@/components/analytics/AttributionTracker";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ExitIntentOfferGate />
      <AttributionTracker />
    </>
  );
}
