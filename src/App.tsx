/*import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./common/Header";
import Sidebar from "./common/SideBar";
import LamportPage from "./pages/LamportPage";
import RicartPage from "./pages/RicartPage";
import LeLannPage from "./pages/leLannPage";
import RicartTokenPage from "./pages/RicartTokenPage";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />

        <div className="app-layout">
          <Sidebar />

          <main className="app-main">
            <Routes>
              <Route path="/" element={<LamportPage />} />
              <Route path="/lamport" element={<LamportPage />} />
              <Route path="/ricart" element={<RicartPage />} />
              <Route path="/lelann" element={<LeLannPage />} />
              <Route path="/ricarttoken" element={<RicartTokenPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;*/

import { RouterProvider } from 'react-router-dom';
import { router } from './router/index';

export default function App() {
  return <RouterProvider router={router} />;
}