import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useWebRTC from './hooks/useWebRTC';
import Auth from './pages/Auth';
import Messenger from './pages/Messenger';
import CallModal from './components/Call/CallModal';
import ToastContainer from './components/ToastContainer';
import BootScreen from './components/Boot/BootScreen';
import ScreenTransition from './components/Transition/ScreenTransition';
import GlobalEffects from './components/GlobalEffects';

function App() {
  const { isAuthenticated, init } = useAuthStore();
  const webrtc = useWebRTC();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <Routes>
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <Messenger webrtc={webrtc} /> : <Navigate to="/auth" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Call Modal (always rendered) */}
      {isAuthenticated && <CallModal {...webrtc} />}

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Always-on ambient effects: faint matrix rain + random glitch */}
      <GlobalEffects />

      {/* Screen-transition overlay — wipe / clear / glitch */}
      <ScreenTransition />

      {/* Terminal boot sequence — shown once after login, wipes into the app */}
      {isAuthenticated && !booted && (
        <BootScreen onComplete={() => setBooted(true)} />
      )}
    </>
  );
}

export default App;
