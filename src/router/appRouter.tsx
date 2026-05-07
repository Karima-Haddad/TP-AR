import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import Header from "../common/Header";
import Sidebar from "../common/SideBar";

import FifoPage from "../pages/FifoPage";
import CausalPage from "../pages/CausalPage";
import SequencerPage from "../pages/SequencerPage";

import LamportPage from "../pages/LamportPage";
import RicartPage from "../pages/RicartPage";
import LeLannPage from "../pages/leLannPage";
import RicartTokenPage from "../pages/RicartTokenPage";

import ElectionPage from "../pages/ElectionPage";
import ClockPage from "../pages/ClockPage";

import CutPage from "../pages/CutPage";
import GlobalStatePage from "../pages/GlobalStatePage";
import ChandyPage from "../pages/ChandyPage";

function RootLayout() {
  return (
    <div className="app">
      <Header />

      <div className="app-layout">
        <Sidebar />

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/mutex/lamport" replace />,
      },

      {
        path: "clocks/:algo",
        element: <ClockPage />,
      },

      {
        path: "diffusion/fifo",
        element: <FifoPage />,
      },
      {
        path: "diffusion/causal",
        element: <CausalPage />,
      },
      {
        path: "diffusion/sequencer",
        element: <SequencerPage />,
      },

      {
        path: "mutex/lamport",
        element: <LamportPage />,
      },
      {
        path: "mutex/ricart",
        element: <RicartPage />,
      },
      {
        path: "mutex/lelann",
        element: <LeLannPage />,
      },
      {
        path: "mutex/ricarttoken",
        element: <RicartTokenPage />,
      },

      {
        path: "election/:algo",
        element: <ElectionPage />,
      },

      {
        path: "snapshot/cut",
        element: <CutPage />,
      },
      {
        path: "snapshot/global",
        element: <GlobalStatePage />,
      },
      {
        path: "snapshot/chandy",
        element: <ChandyPage />,
      },
    ],
  },
]);