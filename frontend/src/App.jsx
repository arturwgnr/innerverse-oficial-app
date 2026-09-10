import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { OnboardingProvider } from "./context/OnboardingContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { RequireAuth, RequireOnboarding, RequireNotOnboarded } from "./components/RouteGuards.jsx";
import { AppShell } from "./components/AppShell.jsx";
import { Landing } from "./pages/Landing.jsx";
import { Login } from "./pages/Login.jsx";
import { Onboarding } from "./pages/Onboarding.jsx";
import { Today } from "./pages/Today.jsx";
import { Calendar } from "./pages/Calendar.jsx";
import { Fast } from "./pages/Fast.jsx";
import { Analysis } from "./pages/Analysis.jsx";
import { AboutMe } from "./pages/AboutMe.jsx";
import { AboutMeHistory } from "./pages/AboutMeHistory.jsx";
import { Mindfulness } from "./pages/Mindfulness.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Stats } from "./pages/Stats.jsx";

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
        <OnboardingProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            <Route element={<RequireAuth />}>
              <Route element={<RequireNotOnboarded />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>

              <Route element={<RequireOnboarding />}>
                {/* Outside AppShell on purpose: a full, distraction-free
                    screen with no bottom nav during a mindfulness session. */}
                <Route path="/mindfulness" element={<Mindfulness />} />

                <Route element={<AppShell />}>
                  <Route path="/today" element={<Today />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/fast" element={<Fast />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/about-me" element={<AboutMe />} />
                  <Route path="/about-me/history" element={<AboutMeHistory />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/stats" element={<Stats />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </OnboardingProvider>
        </AuthProvider>
      </BrowserRouter>
      </ToastProvider>
    </LanguageProvider>
  );
}
