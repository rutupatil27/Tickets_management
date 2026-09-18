import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Auth -> Socket -> Notifications: each layer depends on the one above. */}
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <AppRoutes />
              <Toaster
                position="top-right"
                gutter={10}
                toastOptions={{
                  duration: 3800,
                  className:
                    'rounded-xl border border-ink-200/70 bg-white text-sm font-medium text-ink-800 shadow-pop',
                  success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' }, duration: 5000 },
                }}
              />
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
