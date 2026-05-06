import { RouterProvider } from "react-router-dom";
import { router } from "./router/appRouter";

export default function App() {
  return <RouterProvider router={router} />;
}