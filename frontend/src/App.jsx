import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import TeacherLoginPage from "./pages/TeacherLoginPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import PricingPage from "./pages/PricingPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";
import CancelBookingPage from "./pages/CancelBookingPage";

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="booking" element={<BookingPage />} />
            <Route path="cenovnik" element={<PricingPage />} />
            <Route path="o-nama" element={<AboutPage />} />
            <Route path="cancel/:token" element={<CancelBookingPage />} />
            <Route path="teacher/login" element={<TeacherLoginPage />} />
            <Route path="teacher/dashboard" element={<TeacherDashboardPage />} />
            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route path="admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
