import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ElectionPage from './pages/ElectionPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Racine → redirige vers bully */}
        <Route path="/" element={<Navigate to="/election/bully" replace />} />

        {/* /election → redirige vers bully */}
        <Route path="/election" element={<Navigate to="/election/bully" replace />} />

        {/* Route principale : /election/bully  /election/chang-roberts  /election/lelann */}
        <Route path="/election/:algo" element={<ElectionPage />} />

        {/* Toute autre URL → bully */}
        <Route path="*" element={<Navigate to="/election/bully" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
