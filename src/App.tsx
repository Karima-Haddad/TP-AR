import ClockPage from './pages/ClockPage';
import './index.css';

function App() {
  return <ClockPage />;
}

export default App;
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
/*import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./common/Header";
import Sidebar from "./common/SideBar";
import LamportPage from "./pages/LamportPage";
import RicartPage from "./pages/RicartPage";
import LeLannPage from "./pages/leLannPage";
import RicartTokenPage from "./pages/RicartTokenPage";

import Header from "./common/Header";
import Sidebar from "./common/SideBar";

import LamportPage from "./pages/LamportPage";
import RicartPage from "./pages/RicartPage";
import LeLannPage from "./pages/leLannPage";
import RicartTokenPage from "./pages/RicartTokenPage";

import ElectionPage from "./pages/ElectionPage";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />

        <div className="app-layout">
          <Sidebar />

          <main className="app-main">
            <Routes>
              {/* redirect accueil */}
              <Route
                path="/"
                element={<Navigate to="/mutex/lamport" replace />}
              />

              {/* MUTEX */}
              <Route path="/mutex/lamport" element={<LamportPage />} />
              <Route path="/mutex/ricart" element={<RicartPage />} />
              <Route path="/mutex/lelann" element={<LeLannPage />} />
              <Route
                path="/mutex/ricarttoken"
                element={<RicartTokenPage />}
              />

              {/* ELECTION */}
              <Route path="/election/:algo" element={<ElectionPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
export default App;*/

import { RouterProvider } from 'react-router-dom';
import { router } from './router/index';

export default function App() {
  return <RouterProvider router={router} />;
}
export default App
