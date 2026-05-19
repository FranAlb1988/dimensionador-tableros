import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CcmPage } from './pages/CcmPage';
import { CdcPage } from './pages/CdcPage';
import { TdgPage } from './pages/TdgPage';
import { AuxiliaresPage } from './pages/AuxiliaresPage';
import { Home } from './pages/Home';

// HashRouter funciona sin servidor — ideal para GitHub Pages estático.
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ccm', element: <CcmPage /> },
      { path: 'cdc', element: <CdcPage /> },
      { path: 'tdg', element: <TdgPage /> },
      { path: 'auxiliares', element: <AuxiliaresPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
