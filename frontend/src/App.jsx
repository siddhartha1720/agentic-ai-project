import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import { Toaster } from "sonner";

import useFetchMe from "./hooks/useFetchMe";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Agents from "./pages/Agents";
import CreateAgent from "./pages/CreateAgent";
import AgentGenerator from "./pages/AgentGenerator";
import Workflows from "./pages/Workflows";
import WorkflowStudio from "./pages/WorkflowStudio";
import ExecutionHistory from "./pages/ExecutionHistory";
import Approvals from "./pages/Approvals";
import Integrations from "./pages/Integration";
import Pricing from "./pages/Pricing";

function App() {
  useFetchMe();

  const { user, loading, error } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e12] text-zinc-400">
        Loading your account...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e12] p-4 text-red-400">
        {error}
      </div>
    );
  }

  const protect = (element) => (user ? element : <Login />);

  return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Dashboard /> : <Login />} />
          <Route path="/" element={protect(<Dashboard />)} />
          <Route path="/chat" element={protect(<Home />)} />
          <Route path="/agents" element={protect(<Agents />)} />
          <Route path="/agents/new" element={protect(<CreateAgent />)} />
          <Route
            path="/agents/generate"
            element={protect(<AgentGenerator />)}
          />
          <Route path="/workflows" element={protect(<Workflows />)} />
          <Route
            path="/workflows/studio"
            element={protect(<WorkflowStudio />)}
          />
          <Route
            path="/workflows/studio/:id"
            element={protect(<WorkflowStudio />)}
          />
          <Route path="/executions" element={protect(<ExecutionHistory />)} />
          <Route path="/approvals" element={protect(<Approvals />)} />
          <Route path="/integrations" element={protect(<Integrations />)} />
          <Route path="/pricing" element={protect(<Pricing />)} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
