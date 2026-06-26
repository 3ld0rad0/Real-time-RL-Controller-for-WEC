import { createBrowserRouter } from "react-router";
import { HomePage } from "./pages/home";
import { TrainPage } from "./pages/train";
import { TestPage } from "./pages/test";
import { ResultsPage } from "./pages/results";
import { ModelsPage } from "./pages/models";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/train",
    Component: TrainPage,
  },
  {
    path: "/test",
    Component: TestPage,
  },
  {
    path: "/results",
    Component: ResultsPage,
  },
  {
    path: "/models",
    Component: ModelsPage,
  },
]);
