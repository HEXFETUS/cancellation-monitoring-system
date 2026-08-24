import { useState } from "react";
import {
  Home,
  Megaphone,
  BarChart3,
  HeartHandshake,
  Users,
} from "lucide-react";
import { TopTabs } from "../../../shared/components";
import HomePage from "../../landing-page/pages/HomePage";
import EventsNewsPage from "../../landing-page/pages/EventsNewsPage";
import ResultsPage from "../../landing-page/pages/ResultsPage";
import SocialResponsibility from "../../landing-page/pages/SocialResponsibility";
import AboutUs from "../../landing-page/pages/AboutUs";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "events-news", label: "Events & News", icon: Megaphone },
  { id: "results", label: "Results", icon: BarChart3 },
  { id: "social-responsibility", label: "Social Responsibility", icon: HeartHandshake },
  { id: "about-us", label: "About Us", icon: Users },
];

export default function CsrPostsTabbedPage() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="flex flex-col gap-5">
      <TopTabs
        tabs={tabs}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Landing page sections"
      />

      <div className="min-w-0">
        {activeTab === "home" && <HomePage />}
        {activeTab === "events-news" && <EventsNewsPage />}
        {activeTab === "results" && <ResultsPage />}
        {activeTab === "social-responsibility" && <SocialResponsibility />}
        {activeTab === "about-us" && <AboutUs />}
      </div>
    </div>
  );
}
