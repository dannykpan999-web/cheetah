import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './components/DashboardLayout'
import OverviewPage from './pages/OverviewPage'
import DnsPage from './pages/DnsPage'
import ScannerPage from './pages/ScannerPage'
import EndpointPage from './pages/EndpointPage'
import ProfilePage from './pages/ProfilePage'
import SupportPage from './pages/SupportPage'
import { ToastProvider } from './context/ToastContext'
import ToastContainer from './components/ToastContainer'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('access_token') ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ToastProvider>
      <ToastContainer />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/app" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<OverviewPage />} />
          <Route path="dns" element={<DnsPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="endpoint" element={<EndpointPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
