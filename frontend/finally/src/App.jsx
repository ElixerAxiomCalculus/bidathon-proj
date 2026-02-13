import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import VerifyOtp from './pages/VerifyOtp';
import Dashboard from './pages/Dashboard';
import ProfileSettings from './pages/ProfileSettings';
import QuantTerminalPage from './pages/QuantTerminalPage';
import Documentation from './pages/Documentation';
import { getToken } from './services/api';
import './App.css';

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/verify" element={<VerifyOtp />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
      <Route path="/quant-terminal" element={<ProtectedRoute><QuantTerminalPage /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
