import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import CutPage from "./pages/CutPage";
import GlobalStatePage from "./pages/GlobalStatePage";
import ChandyPage from "./pages/ChandyPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cut" replace />} />
        <Route path="/cut" element={<CutPage />} />
        <Route path="/global" element={<GlobalStatePage />} />
        <Route path="/chandy" element={<ChandyPage />} />
        <Route path="*" element={<Navigate to="/cut" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { RouterProvider } from "react-router-dom";
import { router } from "./router/appRouter";

export default function App() {
  return <RouterProvider router={router} />;
}
