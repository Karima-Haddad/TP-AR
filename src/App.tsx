/*import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./common/Header";
import Sidebar from "./common/SideBar";
import LamportPage from "./pages/LamportPage";
import RicartPage from "./pages/RicartPage";
import LeLannPage from "./pages/leLannPage";
import RicartTokenPage from "./pages/RicartTokenPage";


function App() {

  return <h1>hello world</h1> ;
}

export default App;*/

import { RouterProvider } from 'react-router-dom';
import { router } from './router/index';

export default function App() {
  return <RouterProvider router={router} />;
}
export default App
