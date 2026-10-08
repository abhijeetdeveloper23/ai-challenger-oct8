import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ToastProvider } from "./components/Toast";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { EnrichmentPage } from "./pages/EnrichmentPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="flex flex-col">
          <Header />
          {/* Full viewport of content before footer — keeps footer below the fold */}
          <main className="min-h-[100vh]">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
              <Route path="/enrichment" element={<EnrichmentPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
