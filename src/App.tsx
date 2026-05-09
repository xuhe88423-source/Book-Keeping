import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Tickets } from '@/pages/Tickets';
import { Sales } from '@/pages/Sales';
import { Toaster } from '@/components/ui/sonner';
import { ErrorProvider } from '@/contexts/ErrorContext';

function App() {
  return (
    <ErrorProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="sales" element={<Sales />} />
          </Route>
        </Routes>
        <Toaster position="top-center" richColors />
      </HashRouter>
    </ErrorProvider>
  );
}

export default App;
