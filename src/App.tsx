import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BoardPage } from './pages/BoardPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ToastContainer } from './components/common/ToastContainer';

// Component to handle join query parameters: ?join=xyz
const JoinParamHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { joinProjectByCode } = useProjectStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const joinCode = params.get('join');
    if (joinCode && user) {
      joinProjectByCode(joinCode).then((res) => {
        if (res.success && res.projectId) {
          navigate(`/board/${res.projectId}`, { replace: true });
        }
      });
    }
  }, [location.search, user, joinProjectByCode, navigate]);

  return null;
};

export const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <HashRouter>
      <JoinParamHandler />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/board/:projectId"
          element={
            <ProtectedRoute>
              <BoardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
      <ToastContainer />
    </HashRouter>
  );
};

export default App;
