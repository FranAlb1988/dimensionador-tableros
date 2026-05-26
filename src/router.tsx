import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CcmPage } from './pages/CcmPage';
import { CdcPage } from './pages/CdcPage';
import { TdgPage } from './pages/TdgPage';
import { MtPage } from './pages/MtPage';
import { AuxiliaresPage } from './pages/AuxiliaresPage';
import { CalculosPage } from './pages/CalculosPage';
import { Home } from './pages/Home';

// HashRouter funciona sin servidor — ideal para GitHub Pages estático.
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ccm', element: <CcmPage /> },
      // Nota: las páginas estaban históricamente cruzadas — lo que el código llama
      // CdcPage (cofres Pragma + iC60) corresponde en realidad al TDG de servicios,
      // y lo que llama TdgPage (Prisma + barra + salidas) corresponde al CDC industrial
      // (centro de distribución de cargas). Las rutas se intercambian aquí para
      // mostrar al usuario los rótulos correctos sin reescribir el motor de cada uno.
      { path: 'cdc', element: <TdgPage /> },
      { path: 'tdg', element: <CdcPage /> },
      { path: 'mt', element: <MtPage /> },
      { path: 'auxiliares', element: <AuxiliaresPage /> },
      { path: 'calculos', element: <CalculosPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
