import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import Landing from "@/pages/Landing";
import CustomerLogin from "@/pages/CustomerLogin";
import AuthCallback from "@/pages/AuthCallback";
import CustomerDashboard from "@/pages/CustomerDashboard";
import BookNow from "@/pages/BookNow";
import Profile from "@/pages/Profile";
import AdminLogin from "@/pages/AdminLogin";
import AdminShell from "@/pages/AdminShell";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBookings from "@/pages/AdminBookings";
import AdminServices from "@/pages/AdminServices";
import AdminCustomers from "@/pages/AdminCustomers";
import AdminSettings from "@/pages/AdminSettings";

function AppRouter() {
  const location = useLocation();
  // Handle Emergent OAuth session_id in URL fragment BEFORE routing
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/book" element={<BookNow />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="services" element={<AdminServices />} />
        </Route>
      </Routes>
      <Footer />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-center" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
